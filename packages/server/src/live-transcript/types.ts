// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export const LIVE_SOURCE_KINDS = ["companion_sqlite", "ndjson_file", "watch_dir"] as const;

export type LiveSourceKind = (typeof LIVE_SOURCE_KINDS)[number];

export const LIVE_TRANSCRIPT_ACTIONS = ["poll", "ingest", "status", "reset_cursor"] as const;

export type LiveTranscriptAction = (typeof LIVE_TRANSCRIPT_ACTIONS)[number];

export const DEFAULT_LIVE_INGEST_LIMIT = 100;
export const MAX_LIVE_INGEST_LIMIT = 500;
export const MAX_WATCH_DIR_FILES = 200;

export function isLiveSourceKind(value: string): value is LiveSourceKind {
  return (LIVE_SOURCE_KINDS as readonly string[]).includes(value);
}

export function isLiveTranscriptAction(value: string): value is LiveTranscriptAction {
  return (LIVE_TRANSCRIPT_ACTIONS as readonly string[]).includes(value);
}

export interface LiveSegment {
  id: string;
  meeting_id: string | null;
  start_ms: number;
  end_ms: number | null;
  speaker: string;
  text: string;
  line_index: number | null;
}

export interface SourceReadResult {
  segments: LiveSegment[];
  meeting_id: string | null;
  source_path: string;
  skipped_empty: number;
  skipped_invalid: number;
  skipped_denied: number;
  error?: string;
}

export interface IngestCursorState {
  last_segment_id: string | null;
  last_start_ms: number | null;
  last_line_index: number | null;
  ingested_count: number;
  meeting_id: string | null;
}

export interface LivePollResult {
  action: "poll";
  session_id: string;
  source: LiveSourceKind;
  source_path: string;
  meeting_id: string | null;
  ingested: number;
  skipped_empty: number;
  skipped_invalid: number;
  skipped_denied: number;
  complete: boolean;
  remaining: number;
  cursor: IngestCursorState;
  segments: Array<{
    transcript_id: number;
    speaker: string | null;
    text: string;
    source_segment_id: string;
    start_ms: number;
  }>;
}

export interface LiveStatusResult {
  action: "status";
  session_id: string;
  source: LiveSourceKind | null;
  source_path: string | null;
  meeting_id: string | null;
  cursor: IngestCursorState | null;
  cursors: IngestCursorState[];
  companion_db: string | null;
  allow_roots: string[];
}

export interface LiveResetResult {
  action: "reset_cursor";
  session_id: string;
  source: LiveSourceKind | null;
  source_path: string | null;
  reset: number;
}
