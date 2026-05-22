// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Shared type definitions used across all 2d6mcp packages.

export type { DiceRoll, Roll2d6Result, RollCustomResult } from "./dice.js";
export type { RulingResult } from "./prompts.js";

export interface RulingSource {
  system: "ogl" | "dw" | "brp";
  tag: string;
  content: string;
}

export interface RulingRequest {
  question: string;
  rulesSystem?: "ogl" | "dw" | "brp" | "auto";
  sessionId?: string;
  rulesContext?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface RulingResponse {
  ruling: string;
  sources: RulingSource[];
  qualityWarnings?: string[];
  model?: string;
  latencyMs?: number;
}

export interface SessionSummary {
  id: string;
  name?: string;
  system: string;
  segments: number;
  rulings: number;
  startedAt: string;
  endedAt?: string;
}

export interface TranscriptSegment {
  sessionId: string;
  text: string;
  speaker?: string;
  source?: "voice" | "manual" | "discord";
  intent?: "question" | "ruling" | "action" | "narration" | "discussion";
  loggedAt: string;
}
