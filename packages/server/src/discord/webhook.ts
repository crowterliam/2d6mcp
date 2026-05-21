// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { request } from "node:http";
import { request as httpsRequest } from "node:https";

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
  tts?: boolean;
}

export interface PostResult {
  webhook_name: string;
  success: boolean;
  status_code?: number;
  message_id?: string;
  error?: string;
}

const MAX_CONTENT_LENGTH = 2000;
const MAX_EMBEDS = 10;
const MAX_FIELD_NAME = 256;
const MAX_FIELD_VALUE = 1024;
const MAX_EMBED_DESCRIPTION = 4096;
const MAX_EMBED_TITLE = 256;
const MAX_EMBED_FOOTER_TEXT = 2048;
const MAX_EMBED_AUTHOR_NAME = 256;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + "...";
}

function validateMessage(msg: DiscordMessage): string[] {
  const warnings: string[] = [];

  if (!msg.content && (!msg.embeds || msg.embeds.length === 0)) {
    return ["Message must have content or at least one embed."];
  }

  if (msg.content && msg.content.length > MAX_CONTENT_LENGTH) {
    warnings.push(
      `Content truncated from ${msg.content.length} to ${MAX_CONTENT_LENGTH} characters.`
    );
    msg.content = truncate(msg.content, MAX_CONTENT_LENGTH);
  }

  if (msg.embeds) {
    if (msg.embeds.length > MAX_EMBEDS) {
      warnings.push(`Too many embeds (${msg.embeds.length}). Using first ${MAX_EMBEDS}.`);
      msg.embeds = msg.embeds.slice(0, MAX_EMBEDS);
    }

    for (const embed of msg.embeds) {
      if (embed.title) embed.title = truncate(embed.title, MAX_EMBED_TITLE);
      if (embed.description) embed.description = truncate(embed.description, MAX_EMBED_DESCRIPTION);
      if (embed.footer?.text) embed.footer.text = truncate(embed.footer.text, MAX_EMBED_FOOTER_TEXT);
      if (embed.author?.name) embed.author.name = truncate(embed.author.name, MAX_EMBED_AUTHOR_NAME);
      if (embed.fields) {
        for (const field of embed.fields) {
          field.name = truncate(field.name, MAX_FIELD_NAME);
          field.value = truncate(field.value, MAX_FIELD_VALUE);
        }
      }
    }
  }

  return warnings;
}

function postToWebhook(url: string, payload: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const reqFn = isHttps ? httpsRequest : request;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = reqFn(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf-8"),
        });
      });
    });

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out after 10s"));
    });

    req.write(payload);
    req.end();
  });
}

export async function sendDiscordMessage(
  webhookUrl: string,
  webhookName: string,
  message: DiscordMessage
): Promise<PostResult> {
  const errors = validateMessage(message);
  if (errors.length === 1 && !message.content && (!message.embeds || message.embeds.length === 0)) {
    return { webhook_name: webhookName, success: false, error: errors[0] };
  }

  try {
    const payload = JSON.stringify(message);
    const { status, body } = await postToWebhook(webhookUrl, payload);

    if (status >= 200 && status < 300) {
      let messageId: string | undefined;
      try {
        const response = JSON.parse(body);
        messageId = response.id;
      } catch {}
      return { webhook_name: webhookName, success: true, status_code: status, message_id: messageId };
    }

    return {
      webhook_name: webhookName,
      success: false,
      status_code: status,
      error: `HTTP ${status}: ${body.slice(0, 200)}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { webhook_name: webhookName, success: false, error: msg };
  }
}

export function colorFromName(name: string): number {
  const colors: Record<string, number> = {
    red: 0xff0000,
    green: 0x00ff00,
    blue: 0x0000ff,
    yellow: 0xffff00,
    purple: 0x800080,
    orange: 0xffa500,
    cyan: 0x00ffff,
    white: 0xffffff,
    black: 0x000000,
    gold: 0xffd700,
    silver: 0xc0c0c0,
    crimson: 0xdc143c,
    darkred: 0x8b0000,
    darkgreen: 0x006400,
    darkblue: 0x00008b,
    teal: 0x008080,
    magenta: 0xff00ff,
    lime: 0x00ff00,
    navy: 0x000080,
  };
  return colors[name.toLowerCase()] || parseInt(name.replace("#", ""), 16) || 0x2d6;
}
