// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "../config.js";

export const WEBHOOKS_CONFIG_PATH = resolve(PROJECT_ROOT, ".mcp-discord-webhooks.json");

export interface WebhookEntry {
  name: string;
  url: string;
  tags: string[];
  description: string;
}

export interface WebhooksConfig {
  webhooks: WebhookEntry[];
}

function readConfig(): WebhooksConfig {
  if (!existsSync(WEBHOOKS_CONFIG_PATH)) {
    return { webhooks: [] };
  }
  try {
    const raw = readFileSync(WEBHOOKS_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as WebhooksConfig;
  } catch {
    return { webhooks: [] };
  }
}

function writeConfig(config: WebhooksConfig): void {
  writeFileSync(WEBHOOKS_CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function listWebhooks(): WebhookEntry[] {
  return readConfig().webhooks;
}

export function getWebhook(name: string): WebhookEntry | undefined {
  return readConfig().webhooks.find((w) => w.name.toLowerCase() === name.toLowerCase());
}

export function addWebhook(entry: WebhookEntry): { success: boolean; message: string } {
  const config = readConfig();
  const existing = config.webhooks.find(
    (w) => w.name.toLowerCase() === entry.name.toLowerCase()
  );
  if (existing) {
    return { success: false, message: `Webhook "${entry.name}" already exists. Remove it first to update.` };
  }
  config.webhooks.push(entry);
  writeConfig(config);
  return { success: true, message: `Webhook "${entry.name}" added successfully.` };
}

export function removeWebhook(name: string): { success: boolean; message: string } {
  const config = readConfig();
  const idx = config.webhooks.findIndex(
    (w) => w.name.toLowerCase() === name.toLowerCase()
  );
  if (idx === -1) {
    return { success: false, message: `Webhook "${name}" not found.` };
  }
  const removed = config.webhooks.splice(idx, 1)[0];
  writeConfig(config);
  return { success: true, message: `Webhook "${removed.name}" removed.` };
}

export interface RoutingContext {
  channel_type?: string;
  visibility?: string;
  game_context?: string;
  character?: string;
  location?: string;
}

const TAG_SYNONYMS: Record<string, string[]> = {
  gm: ["gm", "gamemaster", "dm", "dungeon-master", "secret", "private", "tower"],
  player: ["player", "players", "public", "table", "party"],
  combat: ["combat", "battle", "fight", "initiative", "attack", "damage"],
  narrative: ["narrative", "story", "roleplay", "rp", "scene", "description"],
  ooc: ["ooc", "out-of-character", "meta", "discussion", "chat"],
  dice: ["dice", "rolls", "rolling"],
  starship: ["starship", "ship", "space", "bridge"],
  exploration: ["exploration", "travel", "journey", "encounter"],
  trade: ["trade", "commerce", "shopping", "equipment", "market"],
  social: ["social", "interaction", "npc", "dialogue", "persuasion"],
  stealth: ["stealth", "sneaking", "hidden", "ambush"],
  magic: ["magic", "spell", "psionic", "arcane", "mystic"],
};

function expandSynonyms(tags: string[]): string[] {
  const expanded = new Set<string>(tags.map((t) => t.toLowerCase()));
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const [canonical, synonyms] of Object.entries(TAG_SYNONYMS)) {
      if (synonyms.includes(lower)) {
        expanded.add(canonical);
        for (const s of synonyms) expanded.add(s);
      }
    }
  }
  return [...expanded];
}

function scoreWebhook(webhook: WebhookEntry, expandedContext: Set<string>): number {
  if (expandedContext.size === 0) return 1;
  const webhookTags = new Set(webhook.tags.map((t) => t.toLowerCase()));
  let score = 0;
  for (const tag of expandedContext) {
    if (webhookTags.has(tag)) score += 2;
  }
  const expandedWebhook = expandSynonyms(webhook.tags);
  const webhookExpandedSet = new Set(expandedWebhook);
  for (const tag of expandedContext) {
    if (webhookExpandedSet.has(tag)) score += 1;
  }
  return score;
}

export function resolveWebhooks(
  contextTags: string[],
  explicitNames?: string[]
): { webhooks: WebhookEntry[]; routing: string } {
  const config = readConfig();

  if (config.webhooks.length === 0) {
    return { webhooks: [], routing: "No webhooks configured." };
  }

  if (explicitNames && explicitNames.length > 0) {
    const names = new Set(explicitNames.map((n) => n.toLowerCase()));
    const matched = config.webhooks.filter((w) => names.has(w.name.toLowerCase()));
    const missing = explicitNames.filter(
      (n) => !config.webhooks.some((w) => w.name.toLowerCase() === n.toLowerCase())
    );
    const parts: string[] = [];
    if (matched.length > 0) {
      parts.push(`Explicitly selected: ${matched.map((w) => w.name).join(", ")}`);
    }
    if (missing.length > 0) {
      parts.push(`Not found: ${missing.join(", ")}`);
    }
    return { webhooks: matched, routing: parts.join(". ") };
  }

  if (contextTags.length === 0) {
    return {
      webhooks: [],
      routing: `No context provided. Please specify either webhook_names or context tags to route to the correct webhook(s). Available webhooks: ${config.webhooks.map((w) => `"${w.name}" (tags: [${w.tags.join(", ")}])`).join("; ")}`,
    };
  }

  const expandedContext = new Set(expandSynonyms(contextTags));
  const scored = config.webhooks
    .map((w) => ({ webhook: w, score: scoreWebhook(w, expandedContext) }))
    .sort((a, b) => b.score - a.score);

  const maxScore = scored[0].score;
  if (maxScore === 0) {
    return {
      webhooks: [],
      routing: `No tag matches found for [${contextTags.join(", ")}]. Please specify webhook_names explicitly. Available webhooks: ${config.webhooks.map((w) => `"${w.name}" (tags: [${w.tags.join(", ")}])`).join("; ")}`,
    };
  }

  const matched = scored
    .filter((s) => s.score === maxScore)
    .map((s) => s.webhook);

  return {
    webhooks: matched,
    routing: `Matched ${matched.length} webhook(s) for context [${contextTags.join(", ")}]: ${matched.map((w) => w.name).join(", ")} (score: ${maxScore})`,
  };
}

export function parseRoutingContext(context: Record<string, string>): string[] {
  const tags: string[] = [];
  if (context.channel_type) tags.push(...context.channel_type.split(",").map((s) => s.trim()));
  if (context.visibility) tags.push(...context.visibility.split(",").map((s) => s.trim()));
  if (context.game_context) tags.push(...context.game_context.split(",").map((s) => s.trim()));
  if (context.character) tags.push(...context.character.split(",").map((s) => s.trim()));
  if (context.location) tags.push(...context.location.split(",").map((s) => s.trim()));
  return [...new Set(tags)];
}
