// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { statSync } from "node:fs";
import { loadConfig } from "../config.js";
import {
  getLiveTranscriptCursor,
  getSession,
  listLiveTranscriptCursors,
  logTranscript,
  openSessionDb,
  resetLiveTranscriptCursor,
  upsertLiveTranscriptCursor,
  type LiveTranscriptCursor,
} from "../session/database.js";
import { discoverCompanionSqlite, liveTranscriptAllowRoots, resolveLiveTranscriptPath } from "./paths.js";
import {
  applyCursor,
  readNdjsonFile,
  readCompanionSegments,
  readWatchDir,
} from "./sources.js";
import {
  DEFAULT_LIVE_INGEST_LIMIT,
  MAX_LIVE_INGEST_LIMIT,
  isLiveSourceKind,
  isLiveTranscriptAction,
  type IngestCursorState,
  type LivePollResult,
  type LiveResetResult,
  type LiveSourceKind,
  type LiveStatusResult,
  type LiveTranscriptAction,
  type SourceReadResult,
} from "./types.js";

export interface LiveTranscriptArgs {
  action?: unknown;
  session_id?: unknown;
  source?: unknown;
  path?: unknown;
  meeting_id?: unknown;
  limit?: unknown;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIVE_INGEST_LIMIT;
  return Math.max(1, Math.min(MAX_LIVE_INGEST_LIMIT, Math.floor(value)));
}

function cursorState(row: LiveTranscriptCursor | null): IngestCursorState | null {
  if (!row) return null;
  return {
    last_segment_id: row.last_segment_id,
    last_start_ms: row.last_start_ms,
    last_line_index: row.last_line_index,
    ingested_count: row.ingested_count,
    meeting_id: row.meeting_id,
  };
}

function inferSourceKind(path: string | undefined, explicit: string): LiveSourceKind {
  if (explicit && isLiveSourceKind(explicit)) return explicit;
  if (!path) return "companion_sqlite";
  try {
    if (statSync(path).isDirectory()) return "watch_dir";
  } catch {
    // Path may not exist yet; infer from extension.
  }
  const lower = path.toLowerCase();
  if (lower.endsWith(".db") || lower.endsWith(".sqlite") || lower.endsWith(".sqlite3")) {
    return "companion_sqlite";
  }
  return "ndjson_file";
}

function sourceKey(path: string, meetingToken: string): string {
  return `${path}::${meetingToken}`;
}

function meetingToken(requested: string): string {
  if (requested && requested.toLowerCase() !== "latest") return requested;
  return "latest";
}

function resolveSourcePath(
  kind: LiveSourceKind,
  requestedPath: string
): { path?: string; error?: string } {
  if (kind === "companion_sqlite" && !requestedPath) {
    const discovered = discoverCompanionSqlite();
    if (!discovered) {
      return {
        error:
          "No companion database path. Set LIVE_TRANSCRIPT_DB, pass path, or place a companion library SQLite file where it can be auto-discovered.",
      };
    }
    const resolved = resolveLiveTranscriptPath(discovered);
    if (!resolved.ok) return { error: resolved.message };
    return { path: resolved.path };
  }

  if (!requestedPath) {
    return { error: "path is required for ndjson_file and watch_dir sources." };
  }

  const resolved = resolveLiveTranscriptPath(requestedPath);
  if (!resolved.ok) return { error: resolved.message };
  return { path: resolved.path };
}

function readSource(
  kind: LiveSourceKind,
  path: string,
  meetingId: string | undefined
): SourceReadResult {
  switch (kind) {
    case "companion_sqlite":
      return readCompanionSegments(path, meetingId);
    case "ndjson_file":
      return readNdjsonFile(path, meetingId);
    case "watch_dir":
      return readWatchDir(path, meetingId);
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

export function runLiveTranscript(
  args: LiveTranscriptArgs | undefined
): { ok: boolean; payload: LivePollResult | LiveStatusResult | LiveResetResult | { error: string } } {
  const actionRaw = asString(args?.action) || "poll";
  if (!isLiveTranscriptAction(actionRaw)) {
    return {
      ok: false,
      payload: { error: "Error: action must be poll, ingest, status, or reset_cursor" },
    };
  }
  const action: LiveTranscriptAction = actionRaw === "ingest" ? "poll" : actionRaw;

  const sessionId = asString(args?.session_id);
  if (!sessionId) {
    return { ok: false, payload: { error: "Error: session_id is required" } };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const session = getSession(db, sessionId);
  if (!session) {
    return { ok: false, payload: { error: `Session not found: ${sessionId}` } };
  }

  const explicitSource = asString(args?.source);
  if (explicitSource && !isLiveSourceKind(explicitSource)) {
    return {
      ok: false,
      payload: { error: "Error: source must be companion_sqlite, ndjson_file, or watch_dir" },
    };
  }

  const requestedPath = asString(args?.path);
  const requestedMeeting = asString(args?.meeting_id);
  const inferred = inferSourceKind(requestedPath || undefined, explicitSource);
  const kind =
    explicitSource || requestedPath || action === "poll"
      ? inferred
      : null;

  switch (action) {
    case "status":
      return handleStatus(sessionId, kind, requestedPath, requestedMeeting);
    case "reset_cursor":
      return handleReset(sessionId, kind, requestedPath, requestedMeeting);
    case "poll":
      return handlePoll(sessionId, inferred, requestedPath, requestedMeeting, asLimit(args?.limit));
    default: {
      const _never: never = action;
      return _never;
    }
  }
}

function handleStatus(
  sessionId: string,
  kind: LiveSourceKind | null,
  requestedPath: string,
  requestedMeeting: string
): { ok: true; payload: LiveStatusResult } {
  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const rows = listLiveTranscriptCursors(db, sessionId);
  let sourcePath: string | null = null;
  let matching: LiveTranscriptCursor | null = null;

  if (kind) {
    const resolved = resolveSourcePath(kind, requestedPath);
    sourcePath = resolved.path ?? (requestedPath || discoverCompanionSqlite());
    if (sourcePath) {
      const token = meetingToken(requestedMeeting);
      matching = getLiveTranscriptCursor(db, sessionId, kind, sourceKey(sourcePath, token));
      if (!matching) {
        matching = rows.find((row) => row.source_kind === kind && row.source_key.startsWith(`${sourcePath}::`)) ?? null;
      }
    }
  } else {
    matching = rows[0] ?? null;
    if (matching) {
      sourcePath = matching.source_key.split("::")[0] ?? null;
    }
  }

  return {
    ok: true,
    payload: {
      action: "status",
      session_id: sessionId,
      source: kind ?? (matching ? (matching.source_kind as LiveSourceKind) : null),
      source_path: sourcePath,
      meeting_id: matching?.meeting_id ?? (requestedMeeting || null),
      cursor: cursorState(matching),
      cursors: rows.map((row) => cursorState(row)!),
      companion_db: discoverCompanionSqlite(),
      allow_roots: liveTranscriptAllowRoots(),
    },
  };
}

function handleReset(
  sessionId: string,
  kind: LiveSourceKind | null,
  requestedPath: string,
  requestedMeeting: string
): { ok: true; payload: LiveResetResult } {
  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  let sourcePath: string | null = null;
  let reset = 0;

  if (kind && requestedPath) {
    const resolved = resolveSourcePath(kind, requestedPath);
    if (resolved.path) {
      sourcePath = resolved.path;
      const token = meetingToken(requestedMeeting);
      reset = resetLiveTranscriptCursor(db, sessionId, kind, sourceKey(resolved.path, token));
    }
  } else if (kind) {
    reset = resetLiveTranscriptCursor(db, sessionId, kind);
  } else {
    reset = resetLiveTranscriptCursor(db, sessionId);
  }

  return {
    ok: true,
    payload: {
      action: "reset_cursor",
      session_id: sessionId,
      source: kind,
      source_path: sourcePath,
      reset,
    },
  };
}

function handlePoll(
  sessionId: string,
  kind: LiveSourceKind,
  requestedPath: string,
  requestedMeeting: string,
  limit: number
): { ok: boolean; payload: LivePollResult | { error: string } } {
  const located = resolveSourcePath(kind, requestedPath);
  if (located.error || !located.path) {
    return { ok: false, payload: { error: located.error ?? "Path is required." } };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const token = meetingToken(requestedMeeting);
  const key = sourceKey(located.path, token);
  const cursor = getLiveTranscriptCursor(db, sessionId, kind, key);

  const meetingForRead =
    token !== "latest" ? requestedMeeting : (cursor?.meeting_id ?? undefined);

  const read = readSource(kind, located.path, meetingForRead);
  if (read.error) {
    return { ok: false, payload: { error: read.error } };
  }

  const resolvedMeeting = read.meeting_id ?? cursor?.meeting_id ?? null;

  const { batch, remaining } = applyCursor(read.segments, cursor, limit);
  const existingCount = cursor?.ingested_count ?? 0;

  const logged = db.transaction(() => {
    const rows: LivePollResult["segments"] = [];
    for (const segment of batch) {
      const saved = logTranscript(db, sessionId, segment.text, segment.speaker, "voice", "narration");
      rows.push({
        transcript_id: saved.id,
        speaker: saved.speaker,
        text: saved.text,
        source_segment_id: segment.id,
        start_ms: segment.start_ms,
      });
    }

    const last = batch[batch.length - 1];
    const nextCursor = upsertLiveTranscriptCursor(db, {
      session_id: sessionId,
      source_kind: kind,
      source_key: key,
      meeting_id: resolvedMeeting,
      last_segment_id: last?.id ?? cursor?.last_segment_id ?? null,
      last_start_ms: last?.start_ms ?? cursor?.last_start_ms ?? null,
      last_line_index: last?.line_index ?? cursor?.last_line_index ?? null,
      ingested_count: existingCount + batch.length,
    });
    return { rows, nextCursor };
  })();

  return {
    ok: true,
    payload: {
      action: "poll",
      session_id: sessionId,
      source: kind,
      source_path: located.path,
      meeting_id: resolvedMeeting,
      ingested: logged.rows.length,
      skipped_empty: read.skipped_empty,
      skipped_invalid: read.skipped_invalid,
      skipped_denied: read.skipped_denied,
      complete: remaining === 0,
      remaining,
      cursor: cursorState(logged.nextCursor)!,
      segments: logged.rows,
    },
  };
}
