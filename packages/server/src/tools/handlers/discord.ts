// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import {
  listWebhooks,
  getWebhook,
  addWebhook,
  removeWebhook,
  resolveWebhooks,
  parseRoutingContext,
  type WebhookEntry,
} from "../../discord/config.js";
import { sendDiscordMessage, colorFromName, type DiscordMessage, type DiscordEmbed, type PostResult } from "../../discord/webhook.js";

export async function handleDiscordPost(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const content = typeof args?.content === "string" ? args.content : undefined;
  const webhookNames = Array.isArray(args?.webhook_names)
    ? (args.webhook_names as string[])
    : undefined;
  const contextObj =
    args?.context && typeof args.context === "object"
      ? (args.context as Record<string, string>)
      : {};
  const username = typeof args?.username === "string" ? args.username : undefined;
  const avatarUrl = typeof args?.avatar_url === "string" ? args.avatar_url : undefined;
  const tts = args?.tts === true;
  const rawEmbeds = Array.isArray(args?.embeds) ? (args.embeds as Record<string, unknown>[]) : undefined;

  const contextTags = parseRoutingContext(contextObj);
  const { webhooks, routing } = resolveWebhooks(contextTags, webhookNames);

  if (webhooks.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              routing,
              results: [],
              error: "No webhooks matched. Use discord_add_webhook to configure webhooks, or provide explicit webhook_names.",
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const embeds: DiscordEmbed[] | undefined = rawEmbeds?.map((e) => {
    const embed: DiscordEmbed = {};
    if (typeof e.title === "string") embed.title = e.title;
    if (typeof e.description === "string") embed.description = e.description;
    if (typeof e.color === "string") embed.color = colorFromName(e.color);
    if (Array.isArray(e.fields)) {
      embed.fields = (e.fields as Record<string, unknown>[]).map((f) => ({
        name: String(f.name ?? ""),
        value: String(f.value ?? ""),
        ...(f.inline === true ? { inline: true } : {}),
      }));
    }
    if (e.footer && typeof e.footer === "object") {
      const footer = e.footer as Record<string, unknown>;
      embed.footer = { text: String(footer.text ?? "") };
    }
    return embed;
  });

  const message: DiscordMessage = {
    ...(content ? { content } : {}),
    ...(username ? { username } : {}),
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    ...(embeds && embeds.length > 0 ? { embeds } : {}),
    ...(tts ? { tts: true } : {}),
  };

  if (!message.content && (!message.embeds || message.embeds.length === 0)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { success: false, error: "Message must have content or at least one embed." },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const results: PostResult[] = await Promise.all(
    webhooks.map((w: { url: string; name: string }) => sendDiscordMessage(w.url, w.name, { ...message }))
  );

  const allSuccess = results.every((r) => r.success);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: allSuccess,
            routing,
            results,
            posted_to: results.map((r) => r.webhook_name),
          },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleDiscordAddWebhook(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const name = typeof args?.name === "string" ? args.name : "";
  const url = typeof args?.url === "string" ? args.url : "";
  const tags = Array.isArray(args?.tags) ? (args.tags as string[]) : [];
  const description = typeof args?.description === "string" ? args.description : "";

  if (!name) {
    return {
      content: [{ type: "text", text: "Error: name is required" }],
      isError: true,
    };
  }
  if (!url) {
    return {
      content: [{ type: "text", text: "Error: url is required" }],
      isError: true,
    };
  }
  if (!url.startsWith("https://discord.com/api/webhooks/") && !url.startsWith("https://discordapp.com/api/webhooks/")) {
    return {
      content: [
        {
          type: "text",
          text: 'Error: URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/... or https://discordapp.com/api/webhooks/...)',
        },
      ],
      isError: true,
    };
  }

  const entry: WebhookEntry = { name, url, tags, description };
  const result = addWebhook(entry);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
}

export async function handleDiscordRemoveWebhook(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const name = typeof args?.name === "string" ? args.name : "";
  if (!name) {
    return {
      content: [{ type: "text", text: "Error: name is required" }],
      isError: true,
    };
  }
  const result = removeWebhook(name);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
}

export async function handleDiscordListWebhooks(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const webhooks = listWebhooks();
  const masked = webhooks.map((w: { name: string; url: string; tags: string[]; description: string }) => ({
    name: w.name,
    url: w.url.replace(/\/[^/]+$/, "/***masked***"),
    tags: w.tags,
    description: w.description,
  }));
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { total: masked.length, webhooks: masked },
          null,
          2
        ),
      },
    ],
  };
}

export async function handleDiscordTestWebhook(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const name = typeof args?.name === "string" ? args.name : "";
  if (!name) {
    return {
      content: [{ type: "text", text: "Error: name is required" }],
      isError: true,
    };
  }

  const webhook = getWebhook(name);
  if (!webhook) {
    return {
      content: [
        {
          type: "text",
          text: `Webhook "${name}" not found. Use discord_list_webhooks to see available webhooks.`,
        },
      ],
      isError: true,
    };
  }

  const result = await sendDiscordMessage(webhook.url, webhook.name, {
    content: "2d6mcp connection test — webhook is working!",
    embeds: [
      {
        title: "Connection Test",
        description: "If you see this message, your webhook is correctly configured.",
        color: 0x2d6,
        footer: { text: "2d6mcp" },
      },
    ],
  });

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: !result.success,
  };
}
