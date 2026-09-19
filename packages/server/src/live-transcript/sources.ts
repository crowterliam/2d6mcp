// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import Database from "better-sqlite3";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import type { LiveTranscriptCursor } from "../session/database.js";
import { resolveLiveTranscriptPath } from "./paths.js";
import {
  MAX_WATCH_DIR_FILES,
  type LiveSegment,
  type SourceReadResult,
} from "./types.js";

const WATCH_EXTENSIONS = new Set([".ndjson", ".jsonl", ".json"]);

export function formatSpeaker(speaker: unknown): string {
  if (typeof speaker === "number" && Number.isFinite(speaker)) {
    return `Speaker ${speaker}`;
  }
  if (typeof speaker === "string") {
    const trimmed = speaker.trim();
    if (!trimmed) return "Speaker 0";
    if (/^-?\d+$/.test(trimmed)) return `Speaker ${trimmed}`;
    return trimmed;
  }
  return "Speaker 0";
}

export function parseLiveRecord(
  raw: unknown,
  fallbackId: string,
  lineIndex: number
): { segment: LiveSegment | null; empty: boolean; invalid: boolean } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { segment: null, empty: false, invalid: true };
  }
  const rec = raw as Record<string, unknown>;
  const text = typeof rec.text === "string" ? rec.text.trim() : "";
  if (!text) return { segment: null, empty: true, invalid: false };

  const start = Number(rec.start_ms);
  const start_ms = Number.isFinite(start) ? start : 0;
  const endRaw = rec.end_ms == null ? null : Number(rec.end_ms);
  const end_ms = endRaw != null && Number.isFinite(endRaw) ? endRaw : null;
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : fallbackId;
  const meeting_id =
    typeof rec.meeting_id === "string" && rec.meeting_id.trim() ? rec.meeting_id.trim() : null;

  return {
    segment: {
      id,
      meeting_id,
      start_ms,
      end_ms,
      speaker: formatSpeaker(rec.speaker),
      text,
      line_index: lineIndex,
    },
    empty: false,
    invalid: false,
  };
}

export function applyCursor(
  records: LiveSegment[],
  cursor: LiveTranscriptCursor | null,
  limit: number
): { batch: LiveSegment[]; remaining: number } {
  let start = 0;
  if (cursor?.last_segment_id) {
    const idx = records.findIndex((row) => row.id === cursor.last_segment_id);
    if (idx >= 0) {
      start = idx + 1;
    } else if (cursor.last_line_index != null && cursor.last_line_index >= 0) {
      const idx2 = records.findIndex(
        (row) => row.line_index != null && row.line_index > cursor.last_line_index!
      );
      start = idx2 >= 0 ? idx2 : records.length;
    } else {
      start = records.length;
    }
  }
  const rest = records.slice(start);
  return {
    batch: rest.slice(0, limit),
    remaining: Math.max(0, rest.length - limit),
  };
}

interface SqliteMeetingRow {
  id: string;
  title: string;
  started_at: string;
}

interface SqliteSegmentRow {
  id: string;
  meeting_id: string;
  start_ms: number;
  end_ms: number;
  speaker: number;
  text: string;
}

export function readCompanionSegments(
  dbPath: string,
  meetingId: string | undefined
): SourceReadResult {
  const result: SourceReadResult = {
    segments: [],
    meeting_id: null,
    source_path: dbPath,
    skipped_empty: 0,
    skipped_invalid: 0,
    skipped_denied: 0,
  };

  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.error = `Unable to open companion SQLite database: ${message}`;
    return result;
  }

  try {
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map(
        (row) => row.name
      )
    );
    if (!tables.has("segments") || !tables.has("meetings")) {
      result.error =
        "SQLite file is missing meetings/segments tables. Expected a companion database with meetings (id, title, started_at, …) and segments (id, meeting_id, start_ms, end_ms, speaker, text).";
      return result;
    }

    const requested = meetingId?.trim() ?? "";
    let resolvedMeeting = requested && requested.toLowerCase() !== "latest" ? requested : "";
    if (!resolvedMeeting) {
      const latest = db
        .prepare(
          "SELECT id, title, started_at FROM meetings ORDER BY started_at DESC, rowid DESC LIMIT 1"
        )
        .get() as SqliteMeetingRow | undefined;
      if (!latest) {
        result.error = "No meetings found in the companion database.";
        return result;
      }
      resolvedMeeting = latest.id;
    } else {
      const found = db.prepare("SELECT id FROM meetings WHERE id = ?").get(resolvedMeeting) as
        | { id: string }
        | undefined;
      if (!found) {
        result.error = `Meeting not found: ${resolvedMeeting}`;
        return result;
      }
    }

    result.meeting_id = resolvedMeeting;
    const rows = db
      .prepare(
        "SELECT id, meeting_id, start_ms, end_ms, speaker, text FROM segments WHERE meeting_id = ? ORDER BY start_ms ASC, id ASC"
      )
      .all(resolvedMeeting) as SqliteSegmentRow[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) {
        result.skipped_empty += 1;
        continue;
      }
      result.segments.push({
        id: String(row.id),
        meeting_id: row.meeting_id,
        start_ms: Number(row.start_ms) || 0,
        end_ms: row.end_ms == null ? null : Number(row.end_ms),
        speaker: formatSpeaker(row.speaker),
        text,
        line_index: i,
      });
    }
    return result;
  } finally {
    db.close();
  }
}

function parseNdjsonContents(contents: string, idPrefix: string): {
  segments: LiveSegment[];
  skipped_empty: number;
  skipped_invalid: number;
} {
  const skipped = { skipped_empty: 0, skipped_invalid: 0 };
  const trimmed = contents.trim();
  if (!trimmed) return { segments: [], ...skipped };

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed)) {
        return { segments: [], skipped_empty: 0, skipped_invalid: 1 };
      }
      const segments: LiveSegment[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const got = parseLiveRecord(parsed[i], `${idPrefix}index:${i}`, i);
        if (got.invalid) skipped.skipped_invalid += 1;
        else if (got.empty) skipped.skipped_empty += 1;
        else if (got.segment) segments.push(got.segment);
      }
      return { segments, ...skipped };
    } catch {
      return { segments: [], skipped_empty: 0, skipped_invalid: 1 };
    }
  }

  const segments: LiveSegment[] = [];
  const lines = contents.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      const got = parseLiveRecord(parsed, `${idPrefix}line:${i}`, i);
      if (got.invalid) skipped.skipped_invalid += 1;
      else if (got.empty) skipped.skipped_empty += 1;
      else if (got.segment) segments.push(got.segment);
    } catch {
      skipped.skipped_invalid += 1;
    }
  }
  return { segments, ...skipped };
}

export function readNdjsonFile(filePath: string, meetingId?: string): SourceReadResult {
  const result: SourceReadResult = {
    segments: [],
    meeting_id: meetingId?.trim() || null,
    source_path: filePath,
    skipped_empty: 0,
    skipped_invalid: 0,
    skipped_denied: 0,
  };

  let contents: string;
  try {
    contents = readFileSync(filePath, "utf8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.error = `Unable to read NDJSON file: ${message}`;
    return result;
  }

  const parsed = parseNdjsonContents(contents, "");
  result.skipped_empty = parsed.skipped_empty;
  result.skipped_invalid = parsed.skipped_invalid;
  const filter = meetingId?.trim();
  result.segments = filter
    ? parsed.segments.filter((seg) => (seg.meeting_id ?? "") === filter)
    : parsed.segments;
  if (filter && result.segments.length > 0) {
    result.meeting_id = filter;
  }
  return result;
}

export function readWatchDir(dirPath: string, meetingId?: string): SourceReadResult {
  const result: SourceReadResult = {
    segments: [],
    meeting_id: meetingId?.trim() || null,
    source_path: dirPath,
    skipped_empty: 0,
    skipped_invalid: 0,
    skipped_denied: 0,
  };

  let names: string[];
  try {
    names = readdirSync(dirPath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.error = `Unable to read watch directory: ${message}`;
    return result;
  }

  const files = names
    .filter((name) => WATCH_EXTENSIONS.has(extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  let fileCount = 0;
  for (const name of files) {
    if (fileCount >= MAX_WATCH_DIR_FILES) break;
    const abs = join(dirPath, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      result.skipped_denied += 1;
      continue;
    }
    if (!st.isFile()) continue;

    const allowed = resolveLiveTranscriptPath(abs);
    if (!allowed.ok) {
      result.skipped_denied += 1;
      continue;
    }

    fileCount += 1;
    const prefix = `${basename(allowed.path)}:`;
    let contents: string;
    try {
      contents = readFileSync(allowed.path, "utf8");
    } catch {
      result.skipped_invalid += 1;
      continue;
    }
    const parsed = parseNdjsonContents(contents, prefix);
    result.skipped_empty += parsed.skipped_empty;
    result.skipped_invalid += parsed.skipped_invalid;
    const offset = result.segments.length;
    for (const seg of parsed.segments) {
      result.segments.push({
        ...seg,
        id: seg.id.includes(":") ? seg.id : `${prefix}${seg.id}`,
        line_index: offset + (seg.line_index ?? 0),
      });
    }
  }

  const filter = meetingId?.trim();
  if (filter) {
    result.segments = result.segments.filter((seg) => (seg.meeting_id ?? "") === filter);
    result.meeting_id = filter;
  }
  return result;
}
