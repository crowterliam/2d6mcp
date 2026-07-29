// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Stripe billing routes.

import { Hono } from "hono";
import type { Env } from "../env.js";
import { verifyToken } from "../middleware/jwt.js";
import type { JwtPayload } from "../types.js";
import {
  getGuild,
  updateGuildPlan,
  updateGuildSubscriptionByCustomer,
} from "../db/queries.js";

const billing = new Hono<{ Bindings: Env }>();

function getStripeAuth(stripeSecretKey: string): string {
  return `Basic ${btoa(`${stripeSecretKey}:`)}`;
}

function resolvePriceIds(env: Env): Record<string, string> {
  return {
    standard_monthly: env.STRIPE_PRICE_STANDARD_MONTHLY || "price_standard_monthly",
    standard_annual: env.STRIPE_PRICE_STANDARD_ANNUAL || "price_standard_annual",
    pro_monthly: env.STRIPE_PRICE_PRO_MONTHLY || "price_pro_monthly",
    pro_annual: env.STRIPE_PRICE_PRO_ANNUAL || "price_pro_annual",
  };
}

function planKeyFromClientPriceId(priceId: string): "standard" | "pro" {
  if (priceId.startsWith("pro_") || priceId === "pro_monthly" || priceId === "pro_annual") {
    return "pro";
  }
  return "standard";
}

function planFromStripePriceId(env: Env, stripePriceId: string): "standard" | "pro" {
  const prices = resolvePriceIds(env);
  if (stripePriceId === prices.pro_monthly || stripePriceId === prices.pro_annual) {
    return "pro";
  }
  if (
    stripePriceId === prices.standard_monthly ||
    stripePriceId === prices.standard_annual ||
    stripePriceId.includes("standard")
  ) {
    return "standard";
  }
  // Fallback: opaque price ids only match when configured via env above.
  if (stripePriceId.toLowerCase().includes("pro")) return "pro";
  return "standard";
}

function planFromSubscription(env: Env, sub: Record<string, unknown>): "standard" | "pro" {
  const metaPlan = (sub.metadata as Record<string, string> | undefined)?.plan;
  if (metaPlan === "pro" || metaPlan === "standard") return metaPlan;
  const items = sub.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  const priceId = items?.data?.[0]?.price?.id || "";
  return planFromStripePriceId(env, priceId);
}

/** Verify Stripe webhook signature (HMAC-SHA256) without the Stripe SDK. */
export async function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300,
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.some((sig) => timingSafeEqualHex(sig, expected));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

billing.post("/api/billing/checkout", async (c) => {
  const env = c.env;
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken<JwtPayload>(token, env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const { priceId, guildId } = await c.req.json<{ priceId: string; guildId: string }>();
  if (!priceId || !guildId) return c.json({ error: "priceId and guildId required" }, 400);

  const guild = await getGuild(env.DB, guildId);
  if (!guild || guild.owner_id !== payload.sub) {
    return c.json({ error: "Not the guild owner" }, 403);
  }

  const priceIds = resolvePriceIds(env);
  const stripePriceId = priceIds[priceId] || priceId;
  const plan = planKeyFromClientPriceId(priceId);

  const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: getStripeAuth(env.STRIPE_SECRET_KEY),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      "line_items[0][price]": stripePriceId,
      "line_items[0][quantity]": "1",
      mode: "subscription",
      success_url: `${env.WEB_URL}/dashboard/settings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_URL}/dashboard/settings`,
      "metadata[guild_id]": guildId,
      "metadata[user_id]": payload.sub,
      "metadata[plan]": plan,
      "subscription_data[metadata][guild_id]": guildId,
      "subscription_data[metadata][plan]": plan,
    }),
  });

  const session = await checkoutRes.json() as { id: string; url: string };
  return c.json({ url: session.url });
});

billing.post("/api/billing/portal", async (c) => {
  const env = c.env;
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyToken<JwtPayload>(token, env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const { guildId } = await c.req.json<{ guildId: string }>();
  const guild = await getGuild(env.DB, guildId);
  if (!guild || guild.owner_id !== payload.sub) {
    return c.json({ error: "Not the guild owner" }, 403);
  }
  if (!guild.stripe_customer_id) {
    return c.json({ error: "No active subscription" }, 400);
  }

  const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: getStripeAuth(env.STRIPE_SECRET_KEY),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: guild.stripe_customer_id,
      return_url: `${env.WEB_URL}/dashboard/settings`,
    }),
  });

  const session = await portalRes.json() as { url: string };
  return c.json({ url: session.url });
});

billing.post("/api/stripe-webhook", async (c) => {
  const env = c.env;
  const sig = c.req.header("Stripe-Signature") || "";
  const body = await c.req.text();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: "Webhook secret not configured" }, 503);
  }

  const valid = await verifyStripeWebhookSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          metadata?: Record<string, string>;
          customer?: string;
          subscription?: string;
        };
        const guildId = session.metadata?.guild_id;
        const plan =
          session.metadata?.plan === "pro" || session.metadata?.plan === "standard"
            ? session.metadata.plan
            : "standard";
        if (guildId && session.customer) {
          await updateGuildPlan(env.DB, guildId, plan, String(session.customer), "active");
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as {
          customer?: string;
          status?: string;
          metadata?: Record<string, string>;
          items?: { data?: Array<{ price?: { id?: string } }> };
        };
        const customerId = sub.customer ? String(sub.customer) : "";
        if (!customerId) break;
        const status = sub.status || "active";
        if (status === "active" || status === "trialing") {
          const plan = planFromSubscription(env, sub);
          await updateGuildSubscriptionByCustomer(env.DB, customerId, plan, status);
        } else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
          await updateGuildSubscriptionByCustomer(env.DB, customerId, "free", status);
        } else {
          const plan = planFromSubscription(env, sub);
          await updateGuildSubscriptionByCustomer(env.DB, customerId, plan, status);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as { customer?: string };
        const customerId = sub.customer ? String(sub.customer) : "";
        if (customerId) {
          await updateGuildSubscriptionByCustomer(env.DB, customerId, "free", "canceled");
        }
        break;
      }
      default:
        break;
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return c.json({ error: "Webhook processing failed" }, 400);
  }
});

export default billing;
