// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

/** Tables hosted by the 2d6mcp SpacetimeDB TypeScript module. */
export const TABLE_CATALOG = [
  "sessions",
  "transcript_segments",
  "rulings",
  "transcription_progress",
  "live_transcript_cursors",
  "chronicle_threads",
  "chronicle_beats",
  "chronicle_entities",
  "chronicle_links",
  "chronicle_hooks",
  "kernel_snapshot",
] as const;

/** Reducers exposed by packages/spacetime/module for a published database. */
export const REDUCER_CATALOG = [
  "apply_kernel_snapshot",
  "create_session",
  "end_session",
  "set_session_summary",
  "log_transcript",
  "store_ruling",
  "delete_session",
  "upsert_live_cursor",
  "reset_live_cursor",
  "upsert_thread",
  "add_beat",
  "upsert_entity",
  "link_entities",
  "unlink_entities",
  "upsert_hook",
  "promote",
] as const;
