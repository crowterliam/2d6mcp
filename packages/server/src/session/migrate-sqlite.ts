// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import type { SessionStore, SessionRow, TranscriptSegment, RulingRow, LiveTranscriptCursor, TranscriptionProgress } from "@2d6mcp/spacetime";

export interface SqliteImportResult {
  path: string;
  imported: boolean;
  sessions: number;
  transcripts: number;
  rulings: number;
  progress: number;
  cursors: number;
  message: string;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim()) return Number(value);
  return fallback;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

/**
 * One-shot import of a legacy better-sqlite3 session file into the Spacetime kernel.
 * Does not delete the source file.
 */
export function importLegacySqliteSessions(store: SessionStore, sqlitePath: string): SqliteImportResult {
  if (!existsSync(sqlitePath)) {
    return {
      path: sqlitePath,
      imported: false,
      sessions: 0,
      transcripts: 0,
      rulings: 0,
      progress: 0,
      cursors: 0,
      message: `No legacy session database at ${sqlitePath}`,
    };
  }

  const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  try {
    const sessionRows = db.prepare("SELECT * FROM sessions").all() as Record<string, unknown>[];
    for (const row of sessionRows) {
      const imported: SessionRow = {
        id: String(row.id),
        name: asString(row.name),
        rules_system: asString(row.rules_system) ?? "ogl",
        byod_system: asString(row.byod_system),
        table_label: asString(row.table_label),
        started_at: asNumber(row.started_at),
        ended_at: row.ended_at == null ? null : asNumber(row.ended_at),
        summary: asString(row.summary),
        summary_generated_at: row.summary_generated_at == null ? null : asNumber(row.summary_generated_at),
      };
      store.importSessionRow(imported);
    }

    let transcripts = 0;
    try {
      const segmentRows = db.prepare("SELECT * FROM transcript_segments").all() as Record<string, unknown>[];
      for (const row of segmentRows) {
        const imported: TranscriptSegment = {
          id: asNumber(row.id),
          session_id: String(row.session_id),
          timestamp: asNumber(row.timestamp),
          speaker: asString(row.speaker),
          text: String(row.text ?? ""),
          source: asString(row.source) ?? "manual",
          intent: asString(row.intent),
        };
        store.importTranscript(imported);
        transcripts += 1;
      }
    } catch {
      // table missing in very old files
    }

    let rulings = 0;
    try {
      const rulingRows = db.prepare("SELECT * FROM rulings").all() as Record<string, unknown>[];
      for (const row of rulingRows) {
        const imported: RulingRow = {
          id: asNumber(row.id),
          session_id: String(row.session_id),
          question: String(row.question ?? ""),
          ruling_text: String(row.ruling_text ?? ""),
          sources: asString(row.sources),
          model_used: asString(row.model_used),
          latency_ms: row.latency_ms == null ? null : asNumber(row.latency_ms),
          created_at: asNumber(row.created_at),
        };
        store.importRuling(imported);
        rulings += 1;
      }
    } catch {
      // optional
    }

    let progress = 0;
    try {
      const progressRows = db.prepare("SELECT * FROM transcription_progress").all() as Record<string, unknown>[];
      for (const row of progressRows) {
        const imported: TranscriptionProgress = {
          file_path: String(row.file_path),
          temp_dir: asString(row.temp_dir),
          chunk_size_seconds: asNumber(row.chunk_size_seconds, 120),
          total_chunks: asNumber(row.total_chunks),
          processed_chunks: [],
          chunk_texts: {},
          source_duration_seconds: row.source_duration_seconds == null ? null : asNumber(row.source_duration_seconds),
          model_used: asString(row.model_used),
          session_id: asString(row.session_id),
          created_at: asNumber(row.created_at),
          updated_at: asNumber(row.updated_at),
        };
        store.importProgress({
          ...imported,
          processed_chunks: row.processed_chunks as TranscriptionProgress["processed_chunks"],
          chunk_texts: row.chunk_texts as TranscriptionProgress["chunk_texts"],
        });
        progress += 1;
      }
    } catch {
      // optional
    }

    let cursors = 0;
    try {
      const cursorRows = db.prepare("SELECT * FROM live_transcript_cursors").all() as Record<string, unknown>[];
      for (const row of cursorRows) {
        const imported: LiveTranscriptCursor = {
          session_id: String(row.session_id),
          source_kind: String(row.source_kind),
          source_key: String(row.source_key),
          meeting_id: asString(row.meeting_id),
          last_segment_id: asString(row.last_segment_id),
          last_start_ms: row.last_start_ms == null ? null : asNumber(row.last_start_ms),
          last_line_index: row.last_line_index == null ? null : asNumber(row.last_line_index),
          ingested_count: asNumber(row.ingested_count),
          updated_at: asNumber(row.updated_at),
        };
        store.importCursor(imported);
        cursors += 1;
      }
    } catch {
      // optional
    }

    store.persistIfNeeded();
    return {
      path: sqlitePath,
      imported: true,
      sessions: sessionRows.length,
      transcripts,
      rulings,
      progress,
      cursors,
      message: `Imported ${sessionRows.length} sessions from ${sqlitePath}`,
    };
  } finally {
    db.close();
  }
}
