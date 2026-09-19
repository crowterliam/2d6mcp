// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Publishable SpacetimeDB TypeScript module. Not compiled by the monorepo tsc.
// Publish: spacetime publish 2d6mcp --module-path packages/spacetime/module
// Local: spacetime start && spacetime publish -s local 2d6mcp --module-path packages/spacetime/module

import { schema, table, t, SenderError } from "spacetimedb/server";

const KernelSnapshot = table(
  { name: "kernel_snapshot", public: true },
  {
    id: t.u8().primaryKey(),
    json: t.string(),
  }
);

const Session = table(
  { name: "sessions", public: true },
  {
    id: t.string().primaryKey(),
    name: t.string().optional(),
    rulesSystem: t.string(),
    byodSystem: t.string().optional(),
    tableLabel: t.string().optional(),
    startedAt: t.u64(),
    endedAt: t.u64().optional(),
    summary: t.string().optional(),
    summaryGeneratedAt: t.u64().optional(),
  }
);

const TranscriptSegment = table(
  { name: "transcript_segments", public: true },
  {
    id: t.u64().primaryKey(),
    sessionId: t.string(),
    timestamp: t.u64(),
    speaker: t.string().optional(),
    text: t.string(),
    source: t.string(),
    intent: t.string().optional(),
  }
);

const Ruling = table(
  { name: "rulings", public: true },
  {
    id: t.u64().primaryKey(),
    sessionId: t.string(),
    question: t.string(),
    rulingText: t.string(),
    sources: t.string().optional(),
    modelUsed: t.string().optional(),
    latencyMs: t.u32().optional(),
    createdAt: t.u64(),
  }
);

const TranscriptionProgress = table(
  { name: "transcription_progress", public: true },
  {
    filePath: t.string().primaryKey(),
    tempDir: t.string().optional(),
    chunkSizeSeconds: t.u32(),
    totalChunks: t.u32(),
    processedChunks: t.string(),
    chunkTexts: t.string(),
    sourceDurationSeconds: t.f64().optional(),
    modelUsed: t.string().optional(),
    sessionId: t.string().optional(),
    createdAt: t.u64(),
    updatedAt: t.u64(),
  }
);

const LiveCursor = table(
  { name: "live_transcript_cursors", public: true },
  {
    id: t.string().primaryKey(),
    sessionId: t.string(),
    sourceKind: t.string(),
    sourceKey: t.string(),
    meetingId: t.string().optional(),
    lastSegmentId: t.string().optional(),
    lastStartMs: t.u64().optional(),
    lastLineIndex: t.u32().optional(),
    ingestedCount: t.u32(),
    updatedAt: t.u64(),
  }
);

const ChronicleThread = table(
  { name: "chronicle_threads", public: true },
  {
    id: t.string().primaryKey(),
    tableLabel: t.string(),
    title: t.string(),
    status: t.string(),
    priority: t.i32(),
    summary: t.string(),
    openedSessionId: t.string().optional(),
    resolvedSessionId: t.string().optional(),
    tags: t.string(),
    updatedAt: t.u64(),
  }
);

const ChronicleBeat = table(
  { name: "chronicle_beats", public: true },
  {
    id: t.string().primaryKey(),
    tableLabel: t.string(),
    threadId: t.string().optional(),
    sessionId: t.string().optional(),
    at: t.u64(),
    kind: t.string(),
    text: t.string(),
    source: t.string(),
    confidence: t.string(),
  }
);

const ChronicleEntity = table(
  { name: "chronicle_entities", public: true },
  {
    id: t.string().primaryKey(),
    tableLabel: t.string(),
    type: t.string(),
    name: t.string(),
    aliases: t.string(),
    status: t.string(),
    notes: t.string(),
    lastSeenSessionId: t.string().optional(),
    confidence: t.string(),
    updatedAt: t.u64(),
  }
);

const ChronicleLink = table(
  { name: "chronicle_links", public: true },
  {
    id: t.string().primaryKey(),
    tableLabel: t.string(),
    fromId: t.string(),
    toId: t.string(),
    rel: t.string(),
    note: t.string(),
  }
);

const ChronicleHook = table(
  { name: "chronicle_hooks", public: true },
  {
    id: t.string().primaryKey(),
    tableLabel: t.string(),
    text: t.string(),
    status: t.string(),
    threadId: t.string().optional(),
    updatedAt: t.u64(),
  }
);

const spacetimedb = schema({
  kernelSnapshot: KernelSnapshot,
  session: Session,
  transcriptSegment: TranscriptSegment,
  ruling: Ruling,
  transcriptionProgress: TranscriptionProgress,
  liveCursor: LiveCursor,
  chronicleThread: ChronicleThread,
  chronicleBeat: ChronicleBeat,
  chronicleEntity: ChronicleEntity,
  chronicleLink: ChronicleLink,
  chronicleHook: ChronicleHook,
});

export default spacetimedb;

export const apply_kernel_snapshot = spacetimedb.reducer({ json: t.string() }, (ctx, { json }) => {
  if (!json) throw new SenderError("json is required");
  const existing = ctx.db.kernelSnapshot.id.find(1);
  if (existing) {
    ctx.db.kernelSnapshot.id.update({ id: 1, json });
  } else {
    ctx.db.kernelSnapshot.insert({ id: 1, json });
  }
});
