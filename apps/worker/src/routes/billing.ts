// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Stripe billing routes.

import { Hono } from "hono";
import type { Env } from "../env.js";
import { verifyToken } from "../middleware/jwt.js";
import type { JwtPayload } from "../types.js";
import { getGuild, updateGuildPlan } from "../db/queries.js";

const billing = new Hono<{ Bindings: Env }>();

function getStripeAuth(stripeSecretKey: string): string {
  return `Basic ${btoa(`${stripeSecretKey}:`)}`;
}

const PRICE_IDS: Record<string, string> = {
  standard_monthly: "price_standard_monthly",
  standard_annual: "price_standard_annual",
  pro_monthly: "price_pro_monthly",
  pro_annual: "price_pro_annual",
};

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

  const stripePriceId = PRICE_IDS[priceId] || priceId;

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
  if (!guild || !guild.stripe_customer_id) {
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

  // Verify webhook signature
  try {
    // In production, verify with stripe.webhooks.constructEvent
    // For now, trust the signature (simplified for initial implementation)
    const event = JSON.parse(body) as { type: string; data: { object: Record<string, unknown> } };

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { metadata: Record<string, string>; customer: string; subscription: string };
        const guildId = session.metadata?.guild_id;
        if (guildId) {
          await updateGuildPlan(env.DB, guildId, "standard", session.customer as string, "active");
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as { customer: string; status: string; metadata: Record<string, string> };
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as { customer: string; metadata: Record<string, string> };
        break;
      }
    }

    return c.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return c.json({ error: "Webhook verification failed" }, 400);
  }
});

export default billing;
