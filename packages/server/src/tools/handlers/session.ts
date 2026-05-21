// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { loadConfig } from "../../config.js";
import {
  openSessionDb,
  createSession,
  endSession,
  setSessionSummary,
  getSession,
  listSessions,
  logTranscript,
  getTranscript,
  getRecentTranscript,
  searchTranscript,
  storeRuling,
  getRecentRulings,
  getRecentContext,
  deleteProgress,
  deleteAllProgress,
  listAllProgress,
  deleteSession,
} from "../../session/database.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../../rulings/mlx-synthesize.js";

export async function handleSessionStart(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const name = typeof args?.name === "string" ? args.name : undefined;
  const rulesSystem = typeof args?.rules_system === "string" ? args.rules_system : "ogl";
  const byodSystem = typeof args?.byod_system === "string" ? args.byod_system : undefined;

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const session = createSession(db, rulesSystem, name, byodSystem);

  return {
    content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
  };
}

export async function handleSessionEnd(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  if (!sessionId) {
    return { content: [{ type: "text", text: "Error: session_id is required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const session = endSession(db, sessionId);

  if (!session) {
    return {
      content: [{ type: "text", text: `Session not found or already ended: ${sessionId}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(session, null, 2) }],
  };
}

export async function handleSessionList(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const limit = typeof args?.limit === "number" ? args.limit : 20;

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const sessions = listSessions(db, limit);

  return {
    content: [{ type: "text", text: JSON.stringify({ sessions, count: sessions.length }, null, 2) }],
  };
}

export async function handleSessionSummarize(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  if (!sessionId) {
    return { content: [{ type: "text", text: "Error: session_id is required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);

  const session = getSession(db, sessionId);
  if (!session) {
    return { content: [{ type: "text", text: `Session not found: ${sessionId}` }], isError: true };
  }

  const segments = getTranscript(db, sessionId, 500);
  if (segments.length === 0) {
    return { content: [{ type: "text", text: "No transcript segments to summarize." }], isError: true };
  }

  const transcriptText = segments.map((s) => {
    const speakerPrefix = s.speaker ? `${s.speaker}: ` : "";
    return `${speakerPrefix}${s.text}`;
  }).join("\n");

  const MAX_CHUNK_SIZE = 2000;

  try {
    let summary: string;

    if (transcriptText.length <= MAX_CHUNK_SIZE) {
      // Short transcript — single pass
      const result = await mlxSynthesizeRuling(
        transcriptText,
        undefined,
        {
          maxTokens: 1024,
          temperature: 0.5,
          systemPrompt: [
            "You summarize TTRPG game sessions concisely.",
            "Include: key events, NPCs encountered, locations visited, combat outcomes, loot found, unresolved threads.",
            "Format as bullet points. Be specific. Do not invent events not in the transcript.",
          ].join("\n"),
        }
      );
      summary = result.response;
    } else {
      // Large transcript — chunk and summarize in stages
      const chunkSummaries: string[] = [];
      let offset = 0;

      while (offset < transcriptText.length) {
        const chunk = transcriptText.substring(offset, offset + MAX_CHUNK_SIZE);
        offset += MAX_CHUNK_SIZE;

        const chunkResult = await mlxSynthesizeRuling(
          chunk,
          undefined,
          {
            maxTokens: 512,
            temperature: 0.3,
            systemPrompt: [
              "Summarize this segment of a TTRPG game session in 3-5 bullet points.",
              "Be specific. Only use events from the provided text.",
            ].join("\n"),
          }
        );
        chunkSummaries.push(chunkResult.response);
      }

      // Summarize the summaries
      const mergedResult = await mlxSynthesizeRuling(
        chunkSummaries.join("\n\n"),
        undefined,
        {
          maxTokens: 1024,
          temperature: 0.5,
          systemPrompt: [
            "You summarize TTRPG game sessions concisely. Below are bullet-point summaries of different parts of one session.",
            "Combine them into a single coherent summary.",
            "Include: key events, NPCs encountered, locations visited, combat outcomes, loot found, unresolved threads.",
            "Format as bullet points. Be specific. Do not invent events not in the provided summaries.",
          ].join("\n"),
        }
      );
      summary = mergedResult.response;
    }

    setSessionSummary(db, sessionId, summary);

    return {
      content: [{ type: "text", text: JSON.stringify({
        session_id: sessionId,
        summary,
        model: "mlx-community/Llama-3.2-3B-Instruct-4bit",
        transcript_length: transcriptText.length,
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [{ type: "text", text: `MLX summarization failed: ${message}` }],
      isError: true,
    };
  }
}

export async function handleLogTranscript(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  const text = typeof args?.text === "string" ? args.text : "";
  const speaker = typeof args?.speaker === "string" ? args.speaker : undefined;
  const source = typeof args?.source === "string" ? args.source : "manual";
  const intent = typeof args?.intent === "string" ? args.intent : undefined;

  if (!sessionId || !text) {
    return { content: [{ type: "text", text: "Error: session_id and text are required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);

  const session = getSession(db, sessionId);
  if (!session) {
    return { content: [{ type: "text", text: `Session not found: ${sessionId}` }], isError: true };
  }

  const segment = logTranscript(db, sessionId, text, speaker, source, intent);

  return {
    content: [{ type: "text", text: JSON.stringify(segment, null, 2) }],
  };
}

export async function handleGetSessionContext(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  const minutes = typeof args?.minutes === "number" ? args.minutes : 5;
  const includeRulings = args?.include_rulings !== false;

  if (!sessionId) {
    return { content: [{ type: "text", text: "Error: session_id is required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);

  const segmentList = getRecentTranscript(db, sessionId, minutes);
  const rulingList = includeRulings ? getRecentRulings(db, sessionId, 5) : [];

  return {
    content: [{ type: "text", text: JSON.stringify({
      session_id: sessionId,
      minutes,
      transcript_count: segmentList.length,
      rulings_count: rulingList.length,
      transcripts: segmentList,
      rulings: rulingList,
    }, null, 2) }],
  };
}

export async function handleSearchTranscript(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  const query = typeof args?.query === "string" ? args.query : "";

  if (!sessionId || !query) {
    return { content: [{ type: "text", text: "Error: session_id and query are required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const results = searchTranscript(db, sessionId, query);

  return {
    content: [{ type: "text", text: JSON.stringify({
      session_id: sessionId,
      query,
      count: results.length,
      results,
    }, null, 2) }],
  };
}

export async function handleListTranscriptions(_args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const items = listAllProgress(db);

  const summary = items.map((p) => ({
    file_path: p.file_path,
    total_chunks: p.total_chunks,
    processed: p.processed_chunks.length,
    remaining: p.total_chunks - p.processed_chunks.length,
    source_duration: p.source_duration_seconds,
    model: p.model_used,
    session_id: p.session_id,
    started: new Date(p.created_at).toISOString(),
    updated: new Date(p.updated_at).toISOString(),
  }));

  return {
    content: [{ type: "text", text: JSON.stringify({ count: items.length, transcriptions: summary }, null, 2) }],
  };
}

export async function handleClearTranscription(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const filePath = typeof args?.file_path === "string" ? args.file_path : undefined;

  if (filePath) {
    deleteProgress(db, filePath);
    return {
      content: [{ type: "text", text: JSON.stringify({
        cleared: filePath,
        message: "Transcription progress reset.",
      }, null, 2) }],
    };
  }

  const count = deleteAllProgress(db);
  return {
    content: [{ type: "text", text: JSON.stringify({
      cleared: count,
      message: `Cleared all ${count} transcription progress records.`,
    }, null, 2) }],
  };
}

export async function handleDeleteSession(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  if (!sessionId) {
    return { content: [{ type: "text", text: "Error: session_id is required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const result = deleteSession(db, sessionId);

  return {
    content: [{ type: "text", text: JSON.stringify({
      session_id: sessionId,
      deleted_transcript_segments: result.transcriptSegments,
      deleted_rulings: result.rulings,
    }, null, 2) }],
  };
}
