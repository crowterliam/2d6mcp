// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export type SpacetimeMode = "embedded" | "remote";

export interface SessionRow {
  id: string;
  name: string | null;
  rules_system: string;
  byod_system: string | null;
  table_label: string | null;
  started_at: number;
  ended_at: number | null;
  summary: string | null;
  summary_generated_at: number | null;
}

export interface TranscriptSegment {
  id: number;
  session_id: string;
  timestamp: number;
  speaker: string | null;
  text: string;
  source: string;
  intent: string | null;
}

export interface RulingRow {
  id: number;
  session_id: string;
  question: string;
  ruling_text: string;
  sources: string | null;
  model_used: string | null;
  latency_ms: number | null;
  created_at: number;
}

export interface TranscriptionProgress {
  file_path: string;
  temp_dir: string | null;
  chunk_size_seconds: number;
  total_chunks: number;
  processed_chunks: number[];
  chunk_texts: Record<string, string>;
  source_duration_seconds: number | null;
  model_used: string | null;
  session_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface LiveTranscriptCursor {
  session_id: string;
  source_kind: string;
  source_key: string;
  meeting_id: string | null;
  last_segment_id: string | null;
  last_start_ms: number | null;
  last_line_index: number | null;
  ingested_count: number;
  updated_at: number;
}

export type ThreadStatus = "open" | "dormant" | "resolved" | "abandoned";
export type BeatKind =
  | "reveal"
  | "decision"
  | "combat"
  | "travel"
  | "rumour"
  | "loot"
  | "consequence"
  | "note";
export type BeatSource = "manual" | "from_transcript" | "from_summary" | "agent";
export type Confidence = "confirmed" | "provisional";
export type EntityType = "person" | "place" | "faction" | "item" | "ship" | "other";
export type HookStatus = "ready" | "used" | "burned";

export const THREAD_STATUSES: readonly ThreadStatus[] = [
  "open",
  "dormant",
  "resolved",
  "abandoned",
];
export const BEAT_KINDS: readonly BeatKind[] = [
  "reveal",
  "decision",
  "combat",
  "travel",
  "rumour",
  "loot",
  "consequence",
  "note",
];
export const BEAT_SOURCES: readonly BeatSource[] = [
  "manual",
  "from_transcript",
  "from_summary",
  "agent",
];
export const CONFIDENCES: readonly Confidence[] = ["confirmed", "provisional"];
export const ENTITY_TYPES: readonly EntityType[] = [
  "person",
  "place",
  "faction",
  "item",
  "ship",
  "other",
];
export const HOOK_STATUSES: readonly HookStatus[] = ["ready", "used", "burned"];

export interface ChronicleThread {
  id: string;
  table_label: string;
  title: string;
  status: ThreadStatus;
  priority: number;
  summary: string;
  opened_session_id: string | null;
  resolved_session_id: string | null;
  tags: string[];
  updated_at: number;
}

export interface ChronicleBeat {
  id: string;
  table_label: string;
  thread_id: string | null;
  session_id: string | null;
  at: number;
  kind: BeatKind;
  text: string;
  source: BeatSource;
  confidence: Confidence;
}

export interface ChronicleEntity {
  id: string;
  table_label: string;
  type: EntityType;
  name: string;
  aliases: string[];
  status: string;
  notes: string;
  last_seen_session_id: string | null;
  confidence: Confidence;
  updated_at: number;
}

export interface ChronicleLink {
  id: string;
  table_label: string;
  from_id: string;
  to_id: string;
  rel: string;
  note: string;
}

export interface ChronicleHook {
  id: string;
  table_label: string;
  text: string;
  status: HookStatus;
  thread_id: string | null;
  updated_at: number;
}

export interface ChronicleBrief {
  table_label: string;
  generated_at: number;
  llm_used: false;
  open_threads: ChronicleThread[];
  recent_beats: ChronicleBeat[];
  hot_entities: ChronicleEntity[];
  ready_hooks: ChronicleHook[];
}

export interface ChronicleSearchHit {
  kind: "beat" | "entity";
  id: string;
  table_label: string;
  text: string;
  extra?: string;
}

export interface ExtractedBeat {
  kind: BeatKind;
  text: string;
  thread_id?: string;
  session_id?: string;
  source: BeatSource;
  confidence: "provisional";
}

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  aliases?: string[];
  notes?: string;
  source: BeatSource;
  confidence: "provisional";
}

export interface ExtractCandidateSet {
  table_label: string;
  session_id: string | null;
  source: BeatSource;
  beats: ExtractedBeat[];
  entities: ExtractedEntity[];
  llm_used: boolean;
  note: string;
}

export interface KernelSnapshot {
  version: 1;
  sessions: SessionRow[];
  segments: TranscriptSegment[];
  nextSegmentId: number;
  rulings: RulingRow[];
  nextRulingId: number;
  progress: TranscriptionProgress[];
  cursors: LiveTranscriptCursor[];
  threads: ChronicleThread[];
  beats: ChronicleBeat[];
  entities: ChronicleEntity[];
  links: ChronicleLink[];
  hooks: ChronicleHook[];
}

export interface OpenStoreOptions {
  isolationKey: string;
  mode: SpacetimeMode;
  persist?: boolean;
  persistPath?: string;
  uri?: string;
  database?: string;
  token?: string;
}

export function isThreadStatus(value: string): value is ThreadStatus {
  return (THREAD_STATUSES as readonly string[]).includes(value);
}

export function isBeatKind(value: string): value is BeatKind {
  return (BEAT_KINDS as readonly string[]).includes(value);
}

export function isBeatSource(value: string): value is BeatSource {
  return (BEAT_SOURCES as readonly string[]).includes(value);
}

export function isConfidence(value: string): value is Confidence {
  return (CONFIDENCES as readonly string[]).includes(value);
}

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export function isHookStatus(value: string): value is HookStatus {
  return (HOOK_STATUSES as readonly string[]).includes(value);
}

export function normalizeTableLabel(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function requireTableLabel(value: string | undefined | null): string {
  const label = normalizeTableLabel(value);
  if (!label) {
    throw new Error("table_label is required");
  }
  return label;
}

export function labelsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLocaleLowerCase() === b.toLocaleLowerCase();
}
