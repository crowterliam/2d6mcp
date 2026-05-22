// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export interface GuildRow {
  guild_id: string;
  owner_id: string;
  plan: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  sessions_used_this_month: number;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  guild_id: string;
  name: string | null;
  rules_system: string;
  byod_system: string | null;
  started_at: string;
  ended_at: string | null;
  status: string;
}

export interface RulingRow {
  id: number;
  session_id: string | null;
  guild_id: string;
  question: string;
  ruling: string;
  source_citations: string | null;
  model_used: string | null;
  latency_ms: number | null;
  quality_warnings: string | null;
  created_at: string;
}

export interface TranscriptRow {
  id: number;
  session_id: string;
  guild_id: string;
  text: string;
  speaker: string | null;
  source: string;
  intent: string | null;
  logged_at: string;
}

export interface RateLimitRow {
  key: string;
  window_start: number;
  count: number;
}

export interface JwtPayload {
  sub: string;
  guilds: string[];
  plan: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export interface RulingSource {
  system: "ogl" | "dw";
  tag: string;
  content: string;
}
