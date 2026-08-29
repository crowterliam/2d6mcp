// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync } from "node:fs";
import { loadConfig } from "../../config.js";
import {
  openSessionDb,
  getRecentRulings,
  getRecentContext,
  storeRuling,
  logTranscript,
  getOrCreateProgress,
  updateProgress,
  markChunkProcessed,
  getNextUnprocessedChunk,
  deleteProgress,
  assembleChunkTranscript,
} from "../../session/database.js";
import { transcribeAudioBuffer } from "../../audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../../rulings/mlx-synthesize.js";
import { questionFromTranscript, retrieveRulesContext } from "../../rulings/retrieve.js";
import { resolveSafePath } from "../helpers.js";
import { isAudioLong, chunkAudio, transcribeChunk, cleanupChunks, getChunkFiles } from "../../audio/chunker.js";
import { handleListTranscriptions, handleClearTranscription } from "./session.js";

const LONG_AUDIO_SECONDS = 180;

export async function handleSynthesizeRuling(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const fromContext = args?.from_context === true;
  const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
  const minutes = typeof args?.minutes === "number"
    ? args.minutes
    : typeof args?.context_minutes === "number"
      ? args.context_minutes
      : 2;

  let question = typeof args?.question === "string" ? args.question : "";

  if (fromContext) {
    if (!sessionId) {
      return { content: [{ type: "text", text: "Error: session_id is required when from_context is true" }], isError: true };
    }
    const config = loadConfig();
    const db = openSessionDb(config.sessionDbPath);
    const { transcripts } = getRecentContext(db, sessionId, minutes);
    if (transcripts.length === 0) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          session_id: sessionId,
          ruling: null,
          note: "No recent transcript available. Log some transcript segments first via log_transcript.",
        }, null, 2) }],
      };
    }
    const transcriptText = transcripts
      .map((t) => {
        const speakerPrefix = t.speaker ? `${t.speaker}: ` : "";
        return `${speakerPrefix}${t.text}`;
      })
      .join("\n");
    question = questionFromTranscript(transcriptText);
  }

  if (!question) {
    return { content: [{ type: "text", text: "Error: question is required" }], isError: true };
  }

  const rulesSystem = typeof args?.rules_system === "string" ? args.rules_system : undefined;
  let rulesContext = typeof args?.rules_context === "string" ? args.rules_context : undefined;

  if (!rulesContext) {
    const retrieved = await retrieveRulesContext({
      question,
      rulesSystem,
      sessionId,
    });
    rulesContext = retrieved.context;
  }

  let sessionHistory = "";
  if (sessionId) {
    const config = loadConfig();
    const db = openSessionDb(config.sessionDbPath);
    const recent = getRecentRulings(db, sessionId, 3);
    if (recent.length > 0) {
      sessionHistory = recent
        .map((r: { question: string; ruling_text: string }) => `Q: ${r.question}\nA: ${r.ruling_text}`)
        .join("\n\n");
    }
  }

  const enrichedContext = sessionHistory
    ? `Previous rulings in this session:\n${sessionHistory}\n\nRelevant rules:\n${rulesContext}`
    : rulesContext;

  try {
    const startTime = Date.now();
    const result = await mlxSynthesizeRuling(question, enrichedContext);
    const latency = Date.now() - startTime;

    if (sessionId) {
      const config = loadConfig();
      const db = openSessionDb(config.sessionDbPath);
      storeRuling(db, sessionId, question, result.response, undefined, result.model, latency);
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        question,
        ruling: result.response,
        model: result.model,
        latency_ms: latency,
        rules_context: rulesContext.substring(0, 500),
        from_context: fromContext || undefined,
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [{ type: "text", text: `MLX synthesis failed: ${message}` }],
      isError: true,
    };
  }
}

export async function handleResolveFromContext(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  return handleSynthesizeRuling({
    ...args,
    from_context: true,
    minutes: typeof args?.context_minutes === "number" ? args.context_minutes : args?.minutes,
  });
}

export async function handleTranscribeAudio(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const action = typeof args?.action === "string" ? args.action : "transcribe";
  if (action === "list") {
    return handleListTranscriptions(args);
  }
  if (action === "clear") {
    return handleClearTranscription(args);
  }

  const filePath = typeof args?.file_path === "string" ? args.file_path : "";
  if (!filePath) {
    return { content: [{ type: "text", text: "Error: file_path is required" }], isError: true };
  }

  const resolvedPath = resolveSafePath(filePath);
  if (!resolvedPath) {
    return {
      content: [{ type: "text", text: "Error: Access denied. File must be within the project directory or BYOD path." }],
      isError: true,
    };
  }

  if (!existsSync(resolvedPath)) {
    return { content: [{ type: "text", text: `Error: File not found: ${resolvedPath}` }], isError: true };
  }

  const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
  const chunkSizeSeconds = typeof args?.chunk_size_seconds === "number" ? args.chunk_size_seconds : 120;
  const config = loadConfig();
  const sessionDb = openSessionDb(config.sessionDbPath);

  if (isAudioLong(resolvedPath, LONG_AUDIO_SECONDS)) {
    try {
      let progress = getOrCreateProgress(sessionDb, resolvedPath);

      if (progress.temp_dir && progress.total_chunks > 0 && !existsSync(progress.temp_dir)) {
        deleteProgress(sessionDb, resolvedPath);
        progress = getOrCreateProgress(sessionDb, resolvedPath);
      }

      if (!progress || progress.total_chunks === 0) {
        const manifest = await chunkAudio(resolvedPath, chunkSizeSeconds);

        updateProgress(sessionDb, resolvedPath, {
          temp_dir: manifest.tempDir,
          total_chunks: manifest.totalChunks,
          chunk_size_seconds: manifest.chunkSizeSeconds,
          source_duration_seconds: manifest.sourceDurationSeconds,
          model_used: config.mlxWhisperModel,
          session_id: sessionId,
        });

        const chunkFile = manifest.chunkFiles[0];
        const diarized = await transcribeChunk(chunkFile, config.mlxWhisperModel);

        markChunkProcessed(sessionDb, resolvedPath, 0, diarized.text);
        if (sessionId) {
          try {
            for (const seg of diarized.segments) {
              logTranscript(sessionDb, sessionId, seg.text, seg.speaker, "voice", "narration");
            }
          } catch { /* log failure is non-fatal */ }
        }

        if (manifest.totalChunks <= 1) {
          if (manifest.tempDir) cleanupChunks(manifest.tempDir);
          const fullText = diarized.text;
          deleteProgress(sessionDb, resolvedPath);
          return {
            content: [{ type: "text", text: JSON.stringify({
              complete: true,
              chunk: 1,
              total_chunks: 1,
              segment_logged: !!sessionId,
              text: diarized.text,
              full_text: fullText,
              segments: diarized.segments,
              speakers_detected: diarized.speakerCount,
            }, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: false,
            chunk: 1,
            total_chunks: manifest.totalChunks,
            segment_logged: !!sessionId,
            text: diarized.text,
            segments: diarized.segments,
            speakers_detected: diarized.speakerCount,
            note: `Call transcribe_audio again with the same file_path and session_id to continue. ${manifest.totalChunks - 1} chunks remaining.`,
          }, null, 2) }],
        };
      }

      const nextChunk = getNextUnprocessedChunk(sessionDb, resolvedPath);

      if (nextChunk === null) {
        const fullText = assembleChunkTranscript(progress);
        if (progress?.temp_dir) cleanupChunks(progress.temp_dir);
        deleteProgress(sessionDb, resolvedPath);

        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: true,
            total_chunks: progress.total_chunks,
            full_text: fullText,
            segment_count: progress.total_chunks,
            duration_seconds: progress.source_duration_seconds,
          }, null, 2) }],
        };
      }

      const chunkFiles = progress?.temp_dir ? getChunkFiles(progress.temp_dir) : [];
      let chunkFile = chunkFiles[nextChunk];
      if (!chunkFile && progress?.temp_dir) {
        const manifest = await chunkAudio(resolvedPath, progress.chunk_size_seconds);
        chunkFile = manifest.chunkFiles[nextChunk];
      }

      const diarized = await transcribeChunk(chunkFile!, config.mlxWhisperModel);

      markChunkProcessed(sessionDb, resolvedPath, nextChunk, diarized.text);
      if (sessionId) {
        try {
          for (const seg of diarized.segments) {
            logTranscript(sessionDb, sessionId, seg.text, seg.speaker, "voice", "narration");
          }
        } catch { /* log failure is non-fatal */ }
      }

      const remaining = (progress?.total_chunks ?? 0) - nextChunk - 1;
      if (remaining <= 0) {
        const completed = getOrCreateProgress(sessionDb, resolvedPath);
        const fullText = assembleChunkTranscript(completed);
        if (progress?.temp_dir) cleanupChunks(progress.temp_dir);
        deleteProgress(sessionDb, resolvedPath);
        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: true,
            chunk: nextChunk + 1,
            total_chunks: progress?.total_chunks ?? 0,
            segment_logged: !!sessionId,
            text: diarized.text,
            full_text: fullText,
            segments: diarized.segments,
            speakers_detected: diarized.speakerCount,
            duration_seconds: progress?.source_duration_seconds,
          }, null, 2) }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({
          complete: false,
          chunk: nextChunk + 1,
          total_chunks: progress?.total_chunks ?? 0,
          segment_logged: !!sessionId,
          text: diarized.text,
          segments: diarized.segments,
          speakers_detected: diarized.speakerCount,
          note: `Call transcribe_audio again with the same file_path and session_id to continue. ${remaining} chunks remaining.`,
        }, null, 2) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return {
        content: [{ type: "text", text: `Chunked transcription failed: ${message}` }],
        isError: true,
      };
    }
  }

  try {
    const buf = readFileSync(resolvedPath);
    const result = await transcribeAudioBuffer(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      { language: undefined }
    );

    if (sessionId) {
      try {
        logTranscript(sessionDb, sessionId, result.text, undefined, "voice", "narration");
      } catch { /* log failure is non-fatal */ }
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        complete: true,
        text: result.text,
        model: result.model,
        language: result.language,
        duration_seconds: result.durationSeconds,
        segment_logged: !!sessionId,
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [{ type: "text", text: `Transcription failed: ${message}` }],
      isError: true,
    };
  }
}
