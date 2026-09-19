// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  closeStore,
  flushStore,
  getOrOpenStore,
  getSnapshotClient,
  hydrateStore,
  type SessionStore,
  type TranscriptionProgress,
} from "@2d6mcp/spacetime";
import type { SpacetimeMode } from "@2d6mcp/spacetime";

export type {
  SessionRow,
  TranscriptSegment,
  RulingRow,
  TranscriptionProgress,
  LiveTranscriptCursor,
  SessionStore,
} from "@2d6mcp/spacetime";

export { parseTranscriptSearchQuery, normalizeTableLabel } from "@2d6mcp/spacetime";
export type { TranscriptSearchMode, ParsedTranscriptQuery } from "@2d6mcp/spacetime";

export const DEFAULT_SPACETIME_URI = "http://127.0.0.1:3000";
export const DEFAULT_SPACETIME_DB = "2d6mcp";
export const DEFAULT_EMBEDDED_PATH = resolve(homedir(), ".2d6mcp", "spacetime-kernel.json");
export const DEFAULT_SQLITE_IMPORT_PATH = resolve(homedir(), ".2d6mcp", "sessions.db");

const DEFAULT_STORE_KEY = "__default__";
let lastOpenedKey: string | null = null;

export function isTestEnv(): boolean {
  return process.env.VITEST !== undefined || process.env.NODE_ENV === "test";
}

export function resolveSpacetimeMode(): SpacetimeMode {
  const raw = (process.env.SPACETIMEDB_MODE ?? "").trim().toLowerCase();
  switch (raw) {
    case "remote":
      return "remote";
    case "embedded":
      return "embedded";
    case "auto":
      return process.env.SPACETIMEDB_URI?.trim() ? "remote" : "embedded";
    default:
      if (isTestEnv()) return "embedded";
      return process.env.SPACETIMEDB_URI?.trim() ? "remote" : "embedded";
  }
}

export function openSessionDb(dbPath: string): SessionStore {
  lastOpenedKey = dbPath;
  return getOrOpenStore({
    isolationKey: dbPath,
    mode: "embedded",
    persist: false,
  });
}

export function sessionStore(): SessionStore {
  if (isTestEnv()) {
    const path = process.env.SESSION_DB_PATH || "__vitest__";
    lastOpenedKey = path;
    return getOrOpenStore({
      isolationKey: path,
      mode: "embedded",
      persist: false,
    });
  }

  const mode = resolveSpacetimeMode();
  const persistPath = process.env.SPACETIMEDB_EMBEDDED_PATH?.trim() || DEFAULT_EMBEDDED_PATH;
  lastOpenedKey = DEFAULT_STORE_KEY;
  return getOrOpenStore({
    isolationKey: DEFAULT_STORE_KEY,
    mode,
    persist: true,
    persistPath,
    uri: process.env.SPACETIMEDB_URI?.trim() || DEFAULT_SPACETIME_URI,
    database: process.env.SPACETIMEDB_DB?.trim() || DEFAULT_SPACETIME_DB,
    token: process.env.SPACETIMEDB_TOKEN?.trim() || undefined,
  });
}

export function closeSessionDb(): void {
  if (lastOpenedKey) {
    closeStore(lastOpenedKey);
    lastOpenedKey = null;
    return;
  }
  closeStore();
}

export async function hydrateSessionStore(): Promise<boolean> {
  sessionStore();
  return hydrateStore(lastOpenedKey ?? DEFAULT_STORE_KEY);
}

export async function flushSessionStore(): Promise<void> {
  if (!lastOpenedKey) return;
  const remote = getSnapshotClient(lastOpenedKey);
  if (!remote) return;
  await flushStore(lastOpenedKey);
}

export function assembleChunkTranscript(progress: TranscriptionProgress): string {
  const parts: string[] = [];
  const n = progress.total_chunks || Object.keys(progress.chunk_texts).length;
  for (let i = 0; i < n; i++) {
    const text = progress.chunk_texts[String(i)];
    if (typeof text === "string" && text.length > 0) parts.push(text);
  }
  return parts.join(" ").trim();
}

export function createSession(
  database: SessionStore,
  rulesSystem: string = "ogl",
  name?: string,
  byodSystem?: string,
  tableLabel?: string
) {
  return database.createSession(rulesSystem, name, byodSystem, tableLabel);
}

export function endSession(database: SessionStore, sessionId: string) {
  return database.endSession(sessionId);
}

export function setSessionSummary(database: SessionStore, sessionId: string, summary: string) {
  return database.setSessionSummary(sessionId, summary);
}

export function getSession(database: SessionStore, sessionId: string) {
  return database.getSession(sessionId);
}

export function getActiveSession(database: SessionStore) {
  return database.getActiveSession();
}

export function listSessions(database: SessionStore, limit: number = 20, tableLabel?: string) {
  return database.listSessions(limit, tableLabel);
}

export function getLatestSessionByLabel(database: SessionStore, tableLabel: string) {
  return database.getLatestSessionByLabel(tableLabel);
}

export function logTranscript(
  database: SessionStore,
  sessionId: string,
  text: string,
  speaker?: string,
  source: string = "manual",
  intent?: string
) {
  return database.logTranscript(sessionId, text, speaker, source, intent);
}

export function getTranscript(database: SessionStore, sessionId: string, limit: number = 50) {
  return database.getTranscript(sessionId, limit);
}

export function getRecentTranscript(database: SessionStore, sessionId: string, minutes: number = 5) {
  return database.getRecentTranscript(sessionId, minutes);
}

export function searchTranscript(database: SessionStore, sessionId: string, query: string) {
  return database.searchTranscript(sessionId, query);
}

export function searchTranscriptByLabel(database: SessionStore, tableLabel: string, query: string) {
  return database.searchTranscriptByLabel(tableLabel, query);
}

export function getRecentTranscriptByLabel(database: SessionStore, tableLabel: string, minutes: number = 5) {
  return database.getRecentTranscriptByLabel(tableLabel, minutes);
}

export function storeRuling(
  database: SessionStore,
  sessionId: string,
  question: string,
  rulingText: string,
  sources?: string[],
  modelUsed?: string,
  latencyMs?: number
) {
  return database.storeRuling(sessionId, question, rulingText, sources, modelUsed, latencyMs);
}

export function getRecentRulings(database: SessionStore, sessionId: string, limit: number = 5) {
  return database.getRecentRulings(sessionId, limit);
}

export function getRecentRulingsByLabel(database: SessionStore, tableLabel: string, limit: number = 5) {
  return database.getRecentRulingsByLabel(tableLabel, limit);
}

export function getRecentContext(database: SessionStore, sessionId: string, minutes: number = 5) {
  return database.getRecentContext(sessionId, minutes);
}

export function getOrCreateProgress(database: SessionStore, filePath: string) {
  return database.getOrCreateProgress(filePath);
}

export function updateProgress(
  database: SessionStore,
  filePath: string,
  updates: Partial<{
    temp_dir: string;
    total_chunks: number;
    chunk_size_seconds: number;
    source_duration_seconds: number;
    model_used: string;
    session_id: string;
  }>
) {
  return database.updateProgress(filePath, updates);
}

export function markChunkProcessed(
  database: SessionStore,
  filePath: string,
  chunkIndex: number,
  text?: string
) {
  return database.markChunkProcessed(filePath, chunkIndex, text);
}

export function getNextUnprocessedChunk(database: SessionStore, filePath: string) {
  return database.getNextUnprocessedChunk(filePath);
}

export function deleteProgress(database: SessionStore, filePath: string) {
  return database.deleteProgress(filePath);
}

export function deleteAllProgress(database: SessionStore) {
  return database.deleteAllProgress();
}

export function listAllProgress(database: SessionStore) {
  return database.listAllProgress();
}

export function deleteSession(database: SessionStore, sessionId: string) {
  return database.deleteSession(sessionId);
}

export function getLiveTranscriptCursor(
  database: SessionStore,
  sessionId: string,
  sourceKind: string,
  sourceKey: string
) {
  return database.getLiveTranscriptCursor(sessionId, sourceKind, sourceKey);
}

export function listLiveTranscriptCursors(database: SessionStore, sessionId: string) {
  return database.listLiveTranscriptCursors(sessionId);
}

export function upsertLiveTranscriptCursor(
  database: SessionStore,
  cursor: Omit<import("@2d6mcp/spacetime").LiveTranscriptCursor, "updated_at">
) {
  return database.upsertLiveTranscriptCursor(cursor);
}

export function resetLiveTranscriptCursor(
  database: SessionStore,
  sessionId: string,
  sourceKind?: string,
  sourceKey?: string
) {
  return database.resetLiveTranscriptCursor(sessionId, sourceKind, sourceKey);
}
