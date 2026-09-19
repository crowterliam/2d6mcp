// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  BeatSource,
  ChronicleBeat,
  ChronicleBrief,
  ChronicleEntity,
  ChronicleHook,
  ChronicleLink,
  ChronicleSearchHit,
  ChronicleThread,
  Confidence,
  ExtractCandidateSet,
  ExtractedBeat,
  ExtractedEntity,
  HookStatus,
  KernelSnapshot,
  LiveTranscriptCursor,
  RulingRow,
  SessionRow,
  TranscriptionProgress,
  TranscriptSegment,
} from "./types.js";
import {
  isBeatKind,
  isBeatSource,
  isEntityType,
  isHookStatus,
  isThreadStatus,
  labelsEqual,
  normalizeTableLabel,
  requireTableLabel,
} from "./types.js";
import {
  cursorKey,
  newBeatId,
  newEntityId,
  newHookId,
  newLinkId,
  newSessionId,
  newThreadId,
} from "./ids.js";
import { textMatchesQuery } from "./search.js";

export interface UpsertThreadInput {
  id?: string;
  table_label: string;
  title: string;
  status?: string;
  priority?: number;
  summary?: string;
  opened_session_id?: string;
  resolved_session_id?: string;
  tags?: string[];
}

export interface AddBeatInput {
  table_label?: string;
  thread_id?: string;
  session_id?: string;
  at?: number;
  kind?: string;
  text: string;
  source?: string;
  confidence?: string;
}

export interface UpsertEntityInput {
  id?: string;
  table_label: string;
  type?: string;
  name: string;
  aliases?: string[];
  status?: string;
  notes?: string;
  last_seen_session_id?: string;
  confidence?: string;
}

export interface UpsertHookInput {
  id?: string;
  table_label: string;
  text: string;
  status?: string;
  thread_id?: string;
}

export interface ListBeatsFilter {
  table_label: string;
  thread_id?: string;
  session_id?: string;
  kind?: string;
  since?: number;
  limit?: number;
}

function parseJsonArray(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

function parseChunkTexts(raw: unknown): Record<string, string> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  if (typeof raw !== "string" || !raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // ignore corrupt JSON
  }
  return {};
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asStringList(value: string[] | undefined): string[] {
  if (!value) return [];
  return value.map((item) => item.trim()).filter(Boolean);
}

function autoCanonBlocked(source: BeatSource, confidence: Confidence): Confidence {
  if (source !== "manual" && confidence === "confirmed") {
    return "provisional";
  }
  return confidence;
}

export class EmbeddedStore {
  readonly kind = "embedded" as const;

  private sessions = new Map<string, SessionRow>();
  private segments: TranscriptSegment[] = [];
  private nextSegmentId = 1;
  private rulings: RulingRow[] = [];
  private nextRulingId = 1;
  private progress = new Map<string, TranscriptionProgress>();
  private cursors = new Map<string, LiveTranscriptCursor>();
  private threads = new Map<string, ChronicleThread>();
  private beats = new Map<string, ChronicleBeat>();
  private entities = new Map<string, ChronicleEntity>();
  private links = new Map<string, ChronicleLink>();
  private hooks = new Map<string, ChronicleHook>();
  private persistPath: string | undefined;
  private persistEnabled: boolean;

  constructor(opts?: { persistPath?: string; persist?: boolean }) {
    this.persistPath = opts?.persistPath;
    this.persistEnabled = Boolean(opts?.persist && opts.persistPath);
    if (this.persistEnabled && this.persistPath && existsSync(this.persistPath)) {
      try {
        const parsed = JSON.parse(readFileSync(this.persistPath, "utf8")) as KernelSnapshot;
        if (parsed?.version === 1) this.loadSnapshot(parsed);
      } catch {
        // Start empty if the snapshot is unreadable.
      }
    }
  }

  transaction<T>(fn: () => T): () => T {
    return () => fn();
  }

  loadSnapshot(snapshot: KernelSnapshot): void {
    this.sessions = new Map(snapshot.sessions.map((row) => [row.id, clone(row)]));
    this.segments = snapshot.segments.map(clone);
    this.nextSegmentId = snapshot.nextSegmentId;
    this.rulings = snapshot.rulings.map(clone);
    this.nextRulingId = snapshot.nextRulingId;
    this.progress = new Map(snapshot.progress.map((row) => [row.file_path, clone(row)]));
    this.cursors = new Map(
      snapshot.cursors.map((row) => [cursorKey(row.session_id, row.source_kind, row.source_key), clone(row)])
    );
    this.threads = new Map(snapshot.threads.map((row) => [row.id, clone(row)]));
    this.beats = new Map(snapshot.beats.map((row) => [row.id, clone(row)]));
    this.entities = new Map(snapshot.entities.map((row) => [row.id, clone(row)]));
    this.links = new Map(snapshot.links.map((row) => [row.id, clone(row)]));
    this.hooks = new Map(snapshot.hooks.map((row) => [row.id, clone(row)]));
  }

  snapshot(): KernelSnapshot {
    return {
      version: 1,
      sessions: [...this.sessions.values()].map(clone),
      segments: this.segments.map(clone),
      nextSegmentId: this.nextSegmentId,
      rulings: this.rulings.map(clone),
      nextRulingId: this.nextRulingId,
      progress: [...this.progress.values()].map(clone),
      cursors: [...this.cursors.values()].map(clone),
      threads: [...this.threads.values()].map(clone),
      beats: [...this.beats.values()].map(clone),
      entities: [...this.entities.values()].map(clone),
      links: [...this.links.values()].map(clone),
      hooks: [...this.hooks.values()].map(clone),
    };
  }

  persistIfNeeded(): void {
    if (!this.persistEnabled || !this.persistPath) return;
    mkdirSync(dirname(this.persistPath), { recursive: true });
    writeFileSync(this.persistPath, `${JSON.stringify(this.snapshot(), null, 2)}\n`, "utf8");
  }

  createSession(
    rulesSystem: string = "ogl",
    name?: string,
    byodSystem?: string,
    tableLabel?: string
  ): SessionRow {
    const id = newSessionId();
    const now = Date.now();
    const row: SessionRow = {
      id,
      name: name ?? null,
      rules_system: rulesSystem,
      byod_system: byodSystem ?? null,
      table_label: normalizeTableLabel(tableLabel),
      started_at: now,
      ended_at: null,
      summary: null,
      summary_generated_at: null,
    };
    this.sessions.set(id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  endSession(sessionId: string): SessionRow | null {
    const existing = this.sessions.get(sessionId);
    if (!existing || existing.ended_at !== null) return null;
    const updated: SessionRow = { ...existing, ended_at: Date.now() };
    this.sessions.set(sessionId, updated);
    this.persistIfNeeded();
    return clone(updated);
  }

  setSessionSummary(sessionId: string, summary: string): boolean {
    const existing = this.sessions.get(sessionId);
    if (!existing) return false;
    this.sessions.set(sessionId, {
      ...existing,
      summary,
      summary_generated_at: Date.now(),
    });
    this.persistIfNeeded();
    return true;
  }

  getSession(sessionId: string): SessionRow | null {
    const row = this.sessions.get(sessionId);
    return row ? clone(row) : null;
  }

  getActiveSession(): SessionRow | null {
    const open = [...this.sessions.values()]
      .filter((row) => row.ended_at === null)
      .sort((a, b) => b.started_at - a.started_at);
    return open[0] ? clone(open[0]) : null;
  }

  listSessions(limit: number = 20, tableLabel?: string): SessionRow[] {
    const label = normalizeTableLabel(tableLabel);
    let rows = [...this.sessions.values()];
    if (label) {
      rows = rows.filter((row) => labelsEqual(row.table_label, label));
    }
    return rows
      .sort((a, b) => b.started_at - a.started_at)
      .slice(0, limit)
      .map(clone);
  }

  getLatestSessionByLabel(tableLabel: string): SessionRow | null {
    const label = normalizeTableLabel(tableLabel);
    if (!label) return null;
    const matching = [...this.sessions.values()].filter((row) => labelsEqual(row.table_label, label));
    const active = matching
      .filter((row) => row.ended_at === null)
      .sort((a, b) => b.started_at - a.started_at)[0];
    if (active) return clone(active);
    const latest = matching.sort((a, b) => b.started_at - a.started_at)[0];
    return latest ? clone(latest) : null;
  }

  logTranscript(
    sessionId: string,
    text: string,
    speaker?: string,
    source: string = "manual",
    intent?: string
  ): TranscriptSegment {
    const row: TranscriptSegment = {
      id: this.nextSegmentId++,
      session_id: sessionId,
      timestamp: Date.now(),
      speaker: speaker ?? null,
      text,
      source,
      intent: intent ?? null,
    };
    this.segments.push(row);
    this.persistIfNeeded();
    return clone(row);
  }

  getTranscript(sessionId: string, limit: number = 50): TranscriptSegment[] {
    return this.segments
      .filter((row) => row.session_id === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
      .slice(0, limit)
      .map(clone);
  }

  getRecentTranscript(sessionId: string, minutes: number = 5): TranscriptSegment[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return this.segments
      .filter((row) => row.session_id === sessionId && row.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
      .map(clone);
  }

  searchTranscript(sessionId: string, query: string): TranscriptSegment[] {
    return this.segments
      .filter((row) => row.session_id === sessionId && textMatchesQuery(row.text, query))
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
      .slice(0, 30)
      .map(clone);
  }

  searchTranscriptByLabel(tableLabel: string, query: string): TranscriptSegment[] {
    const label = normalizeTableLabel(tableLabel);
    if (!label) return [];
    const sessionIds = new Set(
      [...this.sessions.values()].filter((row) => labelsEqual(row.table_label, label)).map((row) => row.id)
    );
    return this.segments
      .filter((row) => sessionIds.has(row.session_id) && textMatchesQuery(row.text, query))
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
      .slice(0, 30)
      .map(clone);
  }

  getRecentTranscriptByLabel(tableLabel: string, minutes: number = 5): TranscriptSegment[] {
    const label = normalizeTableLabel(tableLabel);
    if (!label) return [];
    const cutoff = Date.now() - minutes * 60 * 1000;
    const sessionIds = new Set(
      [...this.sessions.values()].filter((row) => labelsEqual(row.table_label, label)).map((row) => row.id)
    );
    return this.segments
      .filter((row) => sessionIds.has(row.session_id) && row.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp || b.id - a.id)
      .map(clone);
  }

  storeRuling(
    sessionId: string,
    question: string,
    rulingText: string,
    sources?: string[],
    modelUsed?: string,
    latencyMs?: number
  ): RulingRow {
    const row: RulingRow = {
      id: this.nextRulingId++,
      session_id: sessionId,
      question,
      ruling_text: rulingText,
      sources: sources ? JSON.stringify(sources) : null,
      model_used: modelUsed ?? null,
      latency_ms: latencyMs ?? null,
      created_at: Date.now(),
    };
    this.rulings.push(row);
    this.persistIfNeeded();
    return clone(row);
  }

  getRecentRulings(sessionId: string, limit: number = 5): RulingRow[] {
    return this.rulings
      .filter((row) => row.session_id === sessionId)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map(clone);
  }

  getRecentRulingsByLabel(tableLabel: string, limit: number = 5): RulingRow[] {
    const label = normalizeTableLabel(tableLabel);
    if (!label) return [];
    const sessionIds = new Set(
      [...this.sessions.values()].filter((row) => labelsEqual(row.table_label, label)).map((row) => row.id)
    );
    return this.rulings
      .filter((row) => sessionIds.has(row.session_id))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit)
      .map(clone);
  }

  getRecentContext(
    sessionId: string,
    minutes: number = 5
  ): { transcripts: TranscriptSegment[]; rulings: RulingRow[] } {
    return {
      transcripts: this.getRecentTranscript(sessionId, minutes),
      rulings: this.getRecentRulings(sessionId, 5),
    };
  }

  getOrCreateProgress(filePath: string): TranscriptionProgress {
    const existing = this.progress.get(filePath);
    if (existing) return clone(existing);
    const now = Date.now();
    const row: TranscriptionProgress = {
      file_path: filePath,
      temp_dir: null,
      chunk_size_seconds: 120,
      total_chunks: 0,
      processed_chunks: [],
      chunk_texts: {},
      source_duration_seconds: null,
      model_used: null,
      session_id: null,
      created_at: now,
      updated_at: now,
    };
    this.progress.set(filePath, row);
    this.persistIfNeeded();
    return clone(row);
  }

  updateProgress(
    filePath: string,
    updates: Partial<{
      temp_dir: string;
      total_chunks: number;
      chunk_size_seconds: number;
      source_duration_seconds: number;
      model_used: string;
      session_id: string;
    }>
  ): void {
    const current = this.getOrCreateProgress(filePath);
    const next: TranscriptionProgress = {
      ...current,
      ...updates,
      processed_chunks: current.processed_chunks,
      chunk_texts: current.chunk_texts,
      updated_at: Date.now(),
    };
    this.progress.set(filePath, next);
    this.persistIfNeeded();
  }

  markChunkProcessed(filePath: string, chunkIndex: number, text?: string): void {
    const progress = this.getOrCreateProgress(filePath);
    const processed = new Set(progress.processed_chunks);
    processed.add(chunkIndex);
    const chunkTexts = { ...progress.chunk_texts };
    if (typeof text === "string") {
      chunkTexts[String(chunkIndex)] = text;
    }
    this.progress.set(filePath, {
      ...progress,
      processed_chunks: [...processed],
      chunk_texts: chunkTexts,
      updated_at: Date.now(),
    });
    this.persistIfNeeded();
  }

  getNextUnprocessedChunk(filePath: string): number | null {
    const progress = this.getOrCreateProgress(filePath);
    for (let i = 0; i < progress.total_chunks; i++) {
      if (!progress.processed_chunks.includes(i)) return i;
    }
    return null;
  }

  deleteProgress(filePath: string): void {
    this.progress.delete(filePath);
    this.persistIfNeeded();
  }

  deleteAllProgress(): number {
    const count = this.progress.size;
    this.progress.clear();
    this.persistIfNeeded();
    return count;
  }

  listAllProgress(): TranscriptionProgress[] {
    return [...this.progress.values()]
      .sort((a, b) => b.updated_at - a.updated_at)
      .map(clone);
  }

  deleteSession(sessionId: string): { transcriptSegments: number; rulings: number } {
    const transcriptSegments = this.segments.filter((row) => row.session_id === sessionId).length;
    this.segments = this.segments.filter((row) => row.session_id !== sessionId);
    const rulings = this.rulings.filter((row) => row.session_id === sessionId).length;
    this.rulings = this.rulings.filter((row) => row.session_id !== sessionId);
    for (const key of [...this.cursors.keys()]) {
      if (key.startsWith(`${sessionId}\0`)) this.cursors.delete(key);
    }
    this.sessions.delete(sessionId);
    this.persistIfNeeded();
    return { transcriptSegments, rulings };
  }

  getLiveTranscriptCursor(
    sessionId: string,
    sourceKind: string,
    sourceKey: string
  ): LiveTranscriptCursor | null {
    const row = this.cursors.get(cursorKey(sessionId, sourceKind, sourceKey));
    return row ? clone(row) : null;
  }

  listLiveTranscriptCursors(sessionId: string): LiveTranscriptCursor[] {
    return [...this.cursors.values()]
      .filter((row) => row.session_id === sessionId)
      .sort((a, b) => b.updated_at - a.updated_at)
      .map(clone);
  }

  upsertLiveTranscriptCursor(cursor: Omit<LiveTranscriptCursor, "updated_at">): LiveTranscriptCursor {
    const row: LiveTranscriptCursor = { ...cursor, updated_at: Date.now() };
    this.cursors.set(cursorKey(row.session_id, row.source_kind, row.source_key), row);
    this.persistIfNeeded();
    return clone(row);
  }

  resetLiveTranscriptCursor(sessionId: string, sourceKind?: string, sourceKey?: string): number {
    let removed = 0;
    for (const [key, row] of [...this.cursors.entries()]) {
      if (row.session_id !== sessionId) continue;
      if (sourceKind && row.source_kind !== sourceKind) continue;
      if (sourceKey && row.source_key !== sourceKey) continue;
      this.cursors.delete(key);
      removed += 1;
    }
    this.persistIfNeeded();
    return removed;
  }

  upsertThread(input: UpsertThreadInput): ChronicleThread {
    const tableLabel = requireTableLabel(input.table_label);
    const now = Date.now();
    if (input.id) {
      const existing = this.threads.get(input.id);
      if (!existing || !labelsEqual(existing.table_label, tableLabel)) {
        throw new Error(`Thread not found: ${input.id}`);
      }
      const status = input.status ?? existing.status;
      if (!isThreadStatus(status)) throw new Error("Invalid thread status");
      const updated: ChronicleThread = {
        ...existing,
        title: input.title.trim() || existing.title,
        status,
        priority: typeof input.priority === "number" ? input.priority : existing.priority,
        summary: input.summary ?? existing.summary,
        opened_session_id: input.opened_session_id ?? existing.opened_session_id,
        resolved_session_id: input.resolved_session_id ?? existing.resolved_session_id,
        tags: input.tags ? asStringList(input.tags) : existing.tags,
        updated_at: now,
      };
      this.threads.set(updated.id, updated);
      this.persistIfNeeded();
      return clone(updated);
    }
    const status = input.status ?? "open";
    if (!isThreadStatus(status)) throw new Error("Invalid thread status");
    const row: ChronicleThread = {
      id: newThreadId(),
      table_label: tableLabel,
      title: input.title.trim(),
      status,
      priority: typeof input.priority === "number" ? input.priority : 0,
      summary: input.summary ?? "",
      opened_session_id: input.opened_session_id ?? null,
      resolved_session_id: input.resolved_session_id ?? null,
      tags: asStringList(input.tags),
      updated_at: now,
    };
    if (!row.title) throw new Error("title is required");
    this.threads.set(row.id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  listThreads(tableLabel: string, status?: string): ChronicleThread[] {
    const label = requireTableLabel(tableLabel);
    return [...this.threads.values()]
      .filter((row) => labelsEqual(row.table_label, label))
      .filter((row) => (status ? row.status === status : true))
      .sort((a, b) => b.priority - a.priority || b.updated_at - a.updated_at)
      .map(clone);
  }

  getThread(id: string): ChronicleThread | null {
    const row = this.threads.get(id);
    return row ? clone(row) : null;
  }

  addBeat(input: AddBeatInput): ChronicleBeat {
    const thread = input.thread_id ? this.threads.get(input.thread_id) : undefined;
    const session = input.session_id ? this.sessions.get(input.session_id) : undefined;
    const tableLabel =
      normalizeTableLabel(input.table_label) ??
      thread?.table_label ??
      session?.table_label ??
      null;
    if (!tableLabel) throw new Error("table_label, thread_id, or session_id is required");
    const kind = input.kind ?? "note";
    if (!isBeatKind(kind)) throw new Error("Invalid beat kind");
    const source = (input.source ?? "manual") as BeatSource;
    if (!isBeatSource(source)) throw new Error("Invalid beat source");
    const requested = (input.confidence ?? (source === "manual" ? "confirmed" : "provisional")) as Confidence;
    const confidence = autoCanonBlocked(source, requested);
    const text = input.text.trim();
    if (!text) throw new Error("beat text is required");
    const row: ChronicleBeat = {
      id: newBeatId(),
      table_label: tableLabel,
      thread_id: input.thread_id ?? null,
      session_id: input.session_id ?? null,
      at: input.at ?? Date.now(),
      kind,
      text,
      source,
      confidence,
    };
    this.beats.set(row.id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  listBeats(filter: ListBeatsFilter): ChronicleBeat[] {
    const label = requireTableLabel(filter.table_label);
    const kind = filter.kind;
    if (kind && !isBeatKind(kind)) throw new Error("Invalid beat kind");
    const limit = filter.limit ?? 50;
    return [...this.beats.values()]
      .filter((row) => labelsEqual(row.table_label, label))
      .filter((row) => (filter.thread_id ? row.thread_id === filter.thread_id : true))
      .filter((row) => (filter.session_id ? row.session_id === filter.session_id : true))
      .filter((row) => (kind ? row.kind === kind : true))
      .filter((row) => (typeof filter.since === "number" ? row.at >= filter.since : true))
      .sort((a, b) => b.at - a.at)
      .slice(0, limit)
      .map(clone);
  }

  upsertEntity(input: UpsertEntityInput): ChronicleEntity {
    const tableLabel = requireTableLabel(input.table_label);
    const now = Date.now();
    if (input.id) {
      const existing = this.entities.get(input.id);
      if (!existing || !labelsEqual(existing.table_label, tableLabel)) {
        throw new Error(`Entity not found: ${input.id}`);
      }
      const type = input.type ?? existing.type;
      if (!isEntityType(type)) throw new Error("Invalid entity type");
      const sourceConfidence = input.confidence as Confidence | undefined;
      const updated: ChronicleEntity = {
        ...existing,
        type,
        name: input.name.trim() || existing.name,
        aliases: input.aliases ? asStringList(input.aliases) : existing.aliases,
        status: input.status ?? existing.status,
        notes: input.notes ?? existing.notes,
        last_seen_session_id: input.last_seen_session_id ?? existing.last_seen_session_id,
        confidence: sourceConfidence === "confirmed" ? existing.confidence : (sourceConfidence ?? existing.confidence),
        updated_at: now,
      };
      this.entities.set(updated.id, updated);
      this.persistIfNeeded();
      return clone(updated);
    }
    const type = input.type ?? "other";
    if (!isEntityType(type)) throw new Error("Invalid entity type");
    const requested = (input.confidence ?? "provisional") as Confidence;
    const row: ChronicleEntity = {
      id: newEntityId(),
      table_label: tableLabel,
      type,
      name: input.name.trim(),
      aliases: asStringList(input.aliases),
      status: input.status ?? "active",
      notes: input.notes ?? "",
      last_seen_session_id: input.last_seen_session_id ?? null,
      confidence: requested,
      updated_at: now,
    };
    if (!row.name) throw new Error("name is required");
    const duplicate = [...this.entities.values()].find(
      (item) => labelsEqual(item.table_label, tableLabel) && item.name.toLocaleLowerCase() === row.name.toLocaleLowerCase()
    );
    if (duplicate) {
      const merged: ChronicleEntity = {
        ...duplicate,
        aliases: [...new Set([...duplicate.aliases, ...row.aliases])],
        notes: row.notes || duplicate.notes,
        last_seen_session_id: row.last_seen_session_id ?? duplicate.last_seen_session_id,
        updated_at: now,
      };
      this.entities.set(merged.id, merged);
      this.persistIfNeeded();
      return clone(merged);
    }
    this.entities.set(row.id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  listEntities(tableLabel: string, type?: string): ChronicleEntity[] {
    const label = requireTableLabel(tableLabel);
    return [...this.entities.values()]
      .filter((row) => labelsEqual(row.table_label, label))
      .filter((row) => (type ? row.type === type : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(clone);
  }

  getEntity(id: string): ChronicleEntity | null {
    const row = this.entities.get(id);
    return row ? clone(row) : null;
  }

  link(tableLabel: string, fromId: string, toId: string, rel: string, note?: string): ChronicleLink {
    const label = requireTableLabel(tableLabel);
    if (!fromId || !toId || !rel.trim()) throw new Error("from_id, to_id, and rel are required");
    const existing = [...this.links.values()].find(
      (row) =>
        labelsEqual(row.table_label, label) &&
        row.from_id === fromId &&
        row.to_id === toId &&
        row.rel === rel.trim()
    );
    if (existing) {
      const updated: ChronicleLink = { ...existing, note: note ?? existing.note };
      this.links.set(updated.id, updated);
      this.persistIfNeeded();
      return clone(updated);
    }
    const row: ChronicleLink = {
      id: newLinkId(),
      table_label: label,
      from_id: fromId,
      to_id: toId,
      rel: rel.trim(),
      note: note ?? "",
    };
    this.links.set(row.id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  unlink(tableLabel: string, id?: string, fromId?: string, toId?: string, rel?: string): number {
    const label = requireTableLabel(tableLabel);
    let removed = 0;
    for (const [key, row] of [...this.links.entries()]) {
      if (!labelsEqual(row.table_label, label)) continue;
      if (id && row.id !== id) continue;
      if (fromId && row.from_id !== fromId) continue;
      if (toId && row.to_id !== toId) continue;
      if (rel && row.rel !== rel) continue;
      if (!id && !fromId && !toId) continue;
      this.links.delete(key);
      removed += 1;
    }
    this.persistIfNeeded();
    return removed;
  }

  listLinks(tableLabel: string): ChronicleLink[] {
    const label = requireTableLabel(tableLabel);
    return [...this.links.values()].filter((row) => labelsEqual(row.table_label, label)).map(clone);
  }

  upsertHook(input: UpsertHookInput): ChronicleHook {
    const tableLabel = requireTableLabel(input.table_label);
    const now = Date.now();
    if (input.id) {
      const existing = this.hooks.get(input.id);
      if (!existing || !labelsEqual(existing.table_label, tableLabel)) {
        throw new Error(`Hook not found: ${input.id}`);
      }
      const status = input.status ?? existing.status;
      if (!isHookStatus(status)) throw new Error("Invalid hook status");
      const updated: ChronicleHook = {
        ...existing,
        text: input.text.trim() || existing.text,
        status,
        thread_id: input.thread_id ?? existing.thread_id,
        updated_at: now,
      };
      this.hooks.set(updated.id, updated);
      this.persistIfNeeded();
      return clone(updated);
    }
    const status = (input.status ?? "ready") as HookStatus;
    if (!isHookStatus(status)) throw new Error("Invalid hook status");
    const row: ChronicleHook = {
      id: newHookId(),
      table_label: tableLabel,
      text: input.text.trim(),
      status,
      thread_id: input.thread_id ?? null,
      updated_at: now,
    };
    if (!row.text) throw new Error("hook text is required");
    this.hooks.set(row.id, row);
    this.persistIfNeeded();
    return clone(row);
  }

  listHooks(tableLabel: string, status?: string): ChronicleHook[] {
    const label = requireTableLabel(tableLabel);
    return [...this.hooks.values()]
      .filter((row) => labelsEqual(row.table_label, label))
      .filter((row) => (status ? row.status === status : true))
      .sort((a, b) => b.updated_at - a.updated_at)
      .map(clone);
  }

  brief(tableLabel: string, beatLimit: number = 12): ChronicleBrief {
    const label = requireTableLabel(tableLabel);
    const openThreads = this.listThreads(label, "open");
    const recentBeats = this.listBeats({ table_label: label, limit: beatLimit });
    const recentSessionIds = new Set(this.listSessions(5, label).map((row) => row.id));
    const hotEntities = this.listEntities(label)
      .filter((row) => row.last_seen_session_id && recentSessionIds.has(row.last_seen_session_id))
      .slice(0, 12);
    const fallbackEntities =
      hotEntities.length > 0 ? hotEntities : this.listEntities(label).slice(0, 8);
    return {
      table_label: label,
      generated_at: Date.now(),
      llm_used: false,
      open_threads: openThreads,
      recent_beats: recentBeats,
      hot_entities: fallbackEntities,
      ready_hooks: this.listHooks(label, "ready"),
    };
  }

  promote(tableLabel: string, ids: string[]): { promoted: Array<{ id: string; kind: "beat" | "entity" }>; skipped: string[] } {
    const label = requireTableLabel(tableLabel);
    const promoted: Array<{ id: string; kind: "beat" | "entity" }> = [];
    const skipped: string[] = [];
    for (const id of ids) {
      const beat = this.beats.get(id);
      if (beat && labelsEqual(beat.table_label, label)) {
        if (beat.confidence === "confirmed") {
          skipped.push(id);
          continue;
        }
        this.beats.set(id, { ...beat, confidence: "confirmed" });
        promoted.push({ id, kind: "beat" });
        continue;
      }
      const entity = this.entities.get(id);
      if (entity && labelsEqual(entity.table_label, label)) {
        if (entity.confidence === "confirmed") {
          skipped.push(id);
          continue;
        }
        this.entities.set(id, { ...entity, confidence: "confirmed", updated_at: Date.now() });
        promoted.push({ id, kind: "entity" });
        continue;
      }
      skipped.push(id);
    }
    this.persistIfNeeded();
    return { promoted, skipped };
  }

  searchChronicle(tableLabel: string, query: string, limit: number = 30): ChronicleSearchHit[] {
    const label = requireTableLabel(tableLabel);
    const hits: ChronicleSearchHit[] = [];
    for (const beat of this.beats.values()) {
      if (!labelsEqual(beat.table_label, label)) continue;
      if (textMatchesQuery(beat.text, query)) {
        hits.push({ kind: "beat", id: beat.id, table_label: label, text: beat.text, extra: beat.kind });
      }
    }
    for (const entity of this.entities.values()) {
      if (!labelsEqual(entity.table_label, label)) continue;
      const blob = `${entity.name} ${entity.aliases.join(" ")} ${entity.notes}`;
      if (textMatchesQuery(blob, query) || textMatchesQuery(entity.name, query)) {
        hits.push({
          kind: "entity",
          id: entity.id,
          table_label: label,
          text: entity.name,
          extra: entity.type,
        });
      }
    }
    return hits.slice(0, limit);
  }

  applyExtracted(candidates: ExtractCandidateSet, write: boolean): ExtractCandidateSet {
    if (!write) return candidates;
    const sessionId = candidates.session_id;
    const writtenBeats: ExtractedBeat[] = [];
    const writtenEntities: ExtractedEntity[] = [];
    for (const beat of candidates.beats) {
      const saved = this.addBeat({
        table_label: candidates.table_label,
        thread_id: beat.thread_id,
        session_id: beat.session_id ?? sessionId ?? undefined,
        kind: beat.kind,
        text: beat.text,
        source: beat.source,
        confidence: "provisional",
      });
      writtenBeats.push({
        kind: saved.kind,
        text: saved.text,
        thread_id: saved.thread_id ?? undefined,
        session_id: saved.session_id ?? undefined,
        source: saved.source,
        confidence: "provisional",
      });
    }
    for (const entity of candidates.entities) {
      const saved = this.upsertEntity({
        table_label: candidates.table_label,
        type: entity.type,
        name: entity.name,
        aliases: entity.aliases,
        notes: entity.notes,
        last_seen_session_id: sessionId ?? undefined,
        confidence: "provisional",
      });
      writtenEntities.push({
        type: saved.type,
        name: saved.name,
        aliases: saved.aliases,
        notes: saved.notes,
        source: entity.source,
        confidence: "provisional",
      });
    }
    this.persistIfNeeded();
    return { ...candidates, beats: writtenBeats, entities: writtenEntities };
  }

  importSessionRow(row: SessionRow): void {
    this.sessions.set(row.id, clone(row));
  }

  importTranscript(row: TranscriptSegment): void {
    this.segments.push(clone(row));
    if (row.id >= this.nextSegmentId) this.nextSegmentId = row.id + 1;
  }

  importRuling(row: RulingRow): void {
    this.rulings.push(clone(row));
    if (row.id >= this.nextRulingId) this.nextRulingId = row.id + 1;
  }

  importProgress(row: TranscriptionProgress): void {
    this.progress.set(row.file_path, {
      ...clone(row),
      processed_chunks: parseJsonArray(row.processed_chunks),
      chunk_texts: parseChunkTexts(row.chunk_texts),
    });
  }

  importCursor(row: LiveTranscriptCursor): void {
    this.cursors.set(cursorKey(row.session_id, row.source_kind, row.source_key), clone(row));
  }
}
