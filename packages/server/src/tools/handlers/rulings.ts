// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync } from "node:fs";
import { loadConfig } from "../../config.js";
import { getDatabase } from "@2d6mcp/ogl/database";
import { ensureDwSchema } from "@2d6mcp/dw/database";
import {
  searchOglRules,
  searchOglSkills,
  searchOglEquipment,
  searchCombat,
  searchShipOps,
} from "@2d6mcp/ogl";
import {
  searchDwRules,
  searchDwMoves,
  searchDwClasses,
  searchDwEquipment,
  searchDwGmTools,
} from "@2d6mcp/dw";
import { openSessionDb, getRecentRulings, getRecentContext, storeRuling, logTranscript, getTranscript, getSession, getOrCreateProgress, updateProgress, markChunkProcessed, getNextUnprocessedChunk, deleteProgress } from "../../session/database.js";
import { transcribeAudioBuffer, isMLXWhisperAvailable } from "../../audio/mlx-transcribe.js";
import { synthesizeRuling as mlxSynthesizeRuling, isMLXLLMAvailable } from "../../rulings/mlx-synthesize.js";
import { checkByodConsent, getByodPath } from "../../byod/gate.js";
import { getByodDatabase, searchByodIndex } from "../../byod/search.js";
import { ensureOglDb, ensureDwDb, resolveSafePath, extractKeywords, extractKeywordList, fuzzyKeywordList } from "../helpers.js";
import { isAudioLong, chunkAudio, transcribeChunk, cleanupChunks, getChunkFiles } from "../../audio/chunker.js";

function scoreAndTakeTop(chunks: string[], originalKeywords: string[], fuzzyKeywords: string[], maxChunks: number = 3): string[] {
  const scored = chunks.map((text) => {
    const lower = text.toLowerCase();
    const origHits = originalKeywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    const fuzzyHits = fuzzyKeywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
    // Original keywords weighted 3x, fuzzy expansions 1x
    return { text, score: origHits * 3 + fuzzyHits + (origHits === originalKeywords.length ? 10 : 0) };
  });

  const seen = new Set<string>();
  const deduped = scored.filter((c) => {
    const key = c.text.substring(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => b.score - a.score);
  return deduped.slice(0, maxChunks).map((c) => c.text);
}

export async function handleSynthesizeRuling(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const question = typeof args?.question === "string" ? args.question : "";
  if (!question) {
    return { content: [{ type: "text", text: "Error: question is required" }], isError: true };
  }

  const rulesSystem = typeof args?.rules_system === "string" ? args.rules_system : "auto";
  const sessionId = typeof args?.session_id === "string" ? args.session_id : undefined;
  let rulesContext = typeof args?.rules_context === "string" ? args.rules_context : undefined;

  if (!rulesContext) {
    const { dbPath: oglPath } = ensureOglDb();
    const oglDb = getDatabase(oglPath);
    const dwDbPath = ensureDwDb().dbPath;
    const dwDb = ensureDwSchema(dwDbPath);

    const chunks: string[] = [];
    const keywords = extractKeywords(question);

    if (rulesSystem === "ogl" || rulesSystem === "auto") {
      const oglRules = searchOglRules(oglDb, question);
      if (Array.isArray(oglRules)) {
        for (const r of oglRules) {
          if (typeof r === "object" && r !== null && "title" in r && "snippet" in r) {
            const rule = r as { title: string; snippet: string; section: string };
            chunks.push(`[OGL: ${rule.section} > ${rule.title}]\n${rule.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
          }
        }
      }

      if (keywords) {
        const kwList = fuzzyKeywordList(extractKeywordList(question));
        for (const kw of kwList) {
          const combatRows = searchCombat(oglDb, kw);
          for (const r of combatRows) {
            if (typeof r === "object" && r !== null && "topic" in r && "content" in r) {
              const c = r as { topic: string; content: string; category: string };
              chunks.push(`[OGL Combat: ${c.category} > ${c.topic}]\n${c.content}`);
            }
          }
          const shipRows = searchShipOps(oglDb, kw);
          for (const r of shipRows) {
            if (typeof r === "object" && r !== null && "topic" in r && "content" in r) {
              const s = r as { topic: string; content: string; category: string };
              chunks.push(`[OGL Starships: ${s.category} > ${s.topic}]\n${s.content}`);
            }
          }
          const skillRows = searchOglSkills(oglDb, kw);
          for (const r of skillRows) {
            if (typeof r === "object" && r !== null && "name" in r) {
              const sk = r as { name: string; description: string; characteristic: string };
              chunks.push(`[OGL Skill: ${sk.name} (${sk.characteristic})]\n${sk.description}`);
            }
          }
          const equipRows = searchOglEquipment(oglDb, kw);
          for (const r of equipRows) {
            if (typeof r === "object" && r !== null && "name" in r) {
              const eq = r as { name: string; category: string; techLevel: number; cost: string; description: string };
              chunks.push(`[OGL Equipment: ${eq.name} (TL${eq.techLevel}, ${eq.cost})]\n${eq.description}`);
            }
          }
        }

      }
    }

    if (rulesSystem === "dw" || rulesSystem === "auto") {
      const dwRules = searchDwRules(dwDb, question);
      for (const r of dwRules) {
        if (typeof r === "object" && r !== null && "title" in r && "snippet" in r) {
          const d = r as { title: string; snippet: string; section: string };
          chunks.push(`[DW: ${d.section} > ${d.title}]\n${d.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
        }
      }

      if (keywords) {
        const dwKwList = fuzzyKeywordList(extractKeywordList(question));
        for (const kw of dwKwList) {
          const dwMoves = searchDwMoves(dwDb, kw);
          for (const m of dwMoves) {
            chunks.push(`[DW Move: ${m.name} (${m.category})]\n${m.description}`);
          }
          const dwClasses = searchDwClasses(dwDb, kw);
          for (const c of dwClasses) {
            chunks.push(`[DW Class: ${c.name}]\n${c.description ?? c.starting_moves ?? ""}`);
          }
          const dwEquip = searchDwEquipment(dwDb, kw);
          for (const e of dwEquip) {
            chunks.push(`[DW Equipment: ${e.name} (${e.category})]\n${e.description ?? `${e.cost ?? "?"}, ${e.weight ?? "?"} wt, damage: ${e.damage ?? "none"}`}`);
          }
          const dwGm = searchDwGmTools(dwDb, kw);
          for (const g of dwGm) {
            chunks.push(`[DW GM: ${g.category ?? "rules"} > ${g.topic}]\n${g.content}`);
          }
        }
      }

      // BYOD search (if enabled)
      const byodConsent = checkByodConsent();
      if (byodConsent.allowed && typeof keywords === "string" && keywords) {
        try {
          const byodPath = getByodPath();
          const byodDb = getByodDatabase(byodPath);
          const byodKwList = fuzzyKeywordList(extractKeywordList(question));

          // Read session's BYOD system filter
          let byodSystemFilter = "";
          if (sessionId) {
            const config = loadConfig();
            const db = openSessionDb(config.sessionDbPath);
            const session = getSession(db, sessionId);
            byodSystemFilter = session?.byod_system || "";
          }

          for (const kw of byodKwList) {
            const byodResults = searchByodIndex(byodDb, kw, 5);
            for (const b of byodResults) {
              // Filter by system name if specified
              if (byodSystemFilter) {
                const fileLower = b.fileName.toLowerCase();
                const systemLower = byodSystemFilter.toLowerCase();
                const matches = systemLower.split(/\s+/).every(term => fileLower.includes(term));
                if (!matches) continue;
              }
              chunks.push(`[BYOD: ${b.fileName} > ${b.title}]\n${b.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
            }
          }
        } catch {
          // BYOD DB may not exist or be initialised — skip silently
        }
      }
    }

    rulesContext = scoreAndTakeTop(chunks, extractKeywordList(question), fuzzyKeywordList(extractKeywordList(question))).join("\n\n");
    if (!rulesContext) {
      rulesContext = "No matching rules found in OGL, Dungeon World, or BYOD databases.";
    }
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
  const sessionId = typeof args?.session_id === "string" ? args.session_id : "";
  const contextMinutes = typeof args?.context_minutes === "number" ? args.context_minutes : 2;

  if (!sessionId) {
    return { content: [{ type: "text", text: "Error: session_id is required" }], isError: true };
  }

  const config = loadConfig();
  const db = openSessionDb(config.sessionDbPath);
  const { transcripts } = getRecentContext(db, sessionId, contextMinutes);

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

  const { dbPath: oglPath } = ensureOglDb();
  const oglDb = getDatabase(oglPath);
  const dwDbPath = ensureDwDb().dbPath;
  const dwDb = ensureDwSchema(dwDbPath);

  const chunks: string[] = [];
  const keywords = extractKeywords(transcriptText);

  const oglRules = searchOglRules(oglDb, transcriptText);
  if (Array.isArray(oglRules)) {
    for (const r of oglRules) {
      if (typeof r === "object" && r !== null && "title" in r && "snippet" in r) {
        const rule = r as { title: string; snippet: string; section: string };
        chunks.push(`[OGL: ${rule.section} > ${rule.title}]\n${rule.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
      }
    }
  }

  if (keywords) {
    const kwList = fuzzyKeywordList(extractKeywordList(transcriptText));
    for (const kw of kwList) {
      const combatRows = searchCombat(oglDb, kw);
      for (const r of combatRows) {
        if (typeof r === "object" && r !== null && "topic" in r && "content" in r) {
          const c = r as { topic: string; content: string; category: string };
          chunks.push(`[OGL Combat: ${c.category} > ${c.topic}]\n${c.content}`);
        }
      }
      const shipRows = searchShipOps(oglDb, kw);
      for (const r of shipRows) {
        if (typeof r === "object" && r !== null && "topic" in r && "content" in r) {
          const s = r as { topic: string; content: string; category: string };
          chunks.push(`[OGL Starships: ${s.category} > ${s.topic}]\n${s.content}`);
        }
      }
    }
  }

  const dwRules = searchDwRules(dwDb, transcriptText);
  for (const r of dwRules) {
    if (typeof r === "object" && r !== null && "title" in r && "snippet" in r) {
      const d = r as { title: string; snippet: string; section: string };
      chunks.push(`[DW: ${d.section} > ${d.title}]\n${d.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
    }
  }

  if (keywords) {
    const dwKwList = fuzzyKeywordList(extractKeywordList(transcriptText));
    for (const kw of dwKwList) {
      const dwMoves = searchDwMoves(dwDb, kw);
      for (const m of dwMoves) {
        chunks.push(`[DW Move: ${m.name} (${m.category})]\n${m.description}`);
      }
      const dwEquip = searchDwEquipment(dwDb, kw);
      for (const e of dwEquip) {
        chunks.push(`[DW Equipment: ${e.name} (${e.category})]\n${e.description ?? `${e.cost ?? "?"} wt`}`);
      }
      const dwGm = searchDwGmTools(dwDb, kw);
      for (const g of dwGm) {
        chunks.push(`[DW GM: ${g.category ?? "rules"} > ${g.topic}]\n${g.content}`);
      }
    }
  }

  // BYOD search (if enabled)
  const byodConsent = checkByodConsent();
  if (byodConsent.allowed && typeof keywords === "string" && keywords) {
    try {
      const byodPath = getByodPath();
      const byodDb = getByodDatabase(byodPath);
      const byodKwList = fuzzyKeywordList(extractKeywordList(transcriptText));

      // Read session's BYOD system filter
      let byodSystemFilter = "";
      if (sessionId) {
        const config = loadConfig();
        const db = openSessionDb(config.sessionDbPath);
        const session = getSession(db, sessionId);
        byodSystemFilter = session?.byod_system || "";
      }

      for (const kw of byodKwList) {
        const byodResults = searchByodIndex(byodDb, kw, 5);
        for (const b of byodResults) {
          if (byodSystemFilter) {
            const fileLower = b.fileName.toLowerCase();
            const systemLower = byodSystemFilter.toLowerCase();
            const matches = systemLower.split(/\s+/).every(term => fileLower.includes(term));
            if (!matches) continue;
          }
          chunks.push(`[BYOD: ${b.fileName} > ${b.title}]\n${b.snippet.replace(/<mark>/g, "**").replace(/<\/mark>/g, "**")}`);
        }
      }
    } catch {
      // BYOD DB may not exist or be initialised — skip silently
    }
  }

  const rulesContext = scoreAndTakeTop(chunks, extractKeywordList(transcriptText), fuzzyKeywordList(extractKeywordList(transcriptText))).join("\n\n") || "No matching rules found.";

  const recentRulings = getRecentRulings(db, sessionId, 3);
  const history = recentRulings.length > 0
    ? `Previous rulings:\n${recentRulings.map((r: { question: string; ruling_text: string }) => `Q: ${r.question}\nA: ${r.ruling_text}`).join("\n\n")}\n\n`
    : "";

  const fullContext = `${history}Rules:\n${rulesContext}`;

  try {
    const startTime = Date.now();
    const result = await mlxSynthesizeRuling(
      `Based on this game transcript, provide a rules ruling:\n\n${transcriptText.substring(0, 2000)}`,
      fullContext
    );
    const latency = Date.now() - startTime;

    storeRuling(db, sessionId, transcriptText.substring(0, 200), result.response, undefined, result.model, latency);

    return {
      content: [{ type: "text", text: JSON.stringify({
        session_id: sessionId,
        ruling: result.response,
        model: result.model,
        latency_ms: latency,
        context_used: transcriptText.substring(0, 300),
        rules_sources: rulesContext.substring(0, 500),
      }, null, 2) }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [{ type: "text", text: `MLX resolution failed: ${message}` }],
      isError: true,
    };
  }
}

export async function handleTranscribeAudio(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
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
  const sessionDb = openSessionDb(config.sessionDbPath);  // always open for progress tracking

  // ---- Chunked mode for long files ----
  if (isAudioLong(resolvedPath, 180)) {
    try {
      let progress = getOrCreateProgress(sessionDb, resolvedPath);

      // Detect stale progress: temp_dir was cleaned up but progress still shows incomplete
      if (progress.temp_dir && progress.total_chunks > 0 && !existsSync(progress.temp_dir)) {
        deleteProgress(sessionDb, resolvedPath);
        progress = getOrCreateProgress(sessionDb, resolvedPath);
      }

      // First call — chunk the file
      if (!progress || progress.total_chunks === 0) {
        const manifest = await chunkAudio(resolvedPath, chunkSizeSeconds);

        if (sessionDb) {
          updateProgress(sessionDb, resolvedPath, {
            temp_dir: manifest.tempDir,
            total_chunks: manifest.totalChunks,
            chunk_size_seconds: manifest.chunkSizeSeconds,
            source_duration_seconds: manifest.sourceDurationSeconds,
            model_used: config.mlxWhisperModel,
            session_id: sessionId,
          });
        }

        // Transcribe first chunk
        const chunkFile = manifest.chunkFiles[0];
        const diarized = await transcribeChunk(chunkFile, config.mlxWhisperModel);

        markChunkProcessed(sessionDb, resolvedPath, 0);
        if (sessionId) {
          try {
            for (const seg of diarized.segments) {
              logTranscript(sessionDb, sessionId, seg.text, seg.speaker, "voice", "narration");
            }
          } catch { /* log failure is non-fatal */ }
        }

        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: manifest.totalChunks <= 1,
            chunk: 1,
            total_chunks: manifest.totalChunks,
            segment_logged: !!sessionId,
            text: diarized.text,
            segments: diarized.segments,
            speakers_detected: diarized.speakerCount,
            note: manifest.totalChunks > 1
              ? `Call transcribe_audio again with the same file_path and session_id to continue. ${manifest.totalChunks - 1} chunks remaining.`
              : undefined,
          }, null, 2) }],
        };
      }

      // Continuation call — process next chunk
      const nextChunk = getNextUnprocessedChunk(sessionDb, resolvedPath);

      if (nextChunk === null) {
        // All done — clean up
        if (progress?.temp_dir) {
          const fullText = await getFullTranscript(sessionDb, resolvedPath, progress.temp_dir, sessionId);
          cleanupChunks(progress.temp_dir);
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

        // No temp_dir — stale or corrupted progress. Reset and try again.
        deleteProgress(sessionDb, resolvedPath);
        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: false,
            error: "Transcription progress was lost (temp files cleaned up). Progress has been reset — call transcribe_audio again to restart from chunk 1.",
          }, null, 2) }],
        };
      }

      // Process the next chunk
      const chunkFiles = progress?.temp_dir
        ? getChunkFiles(progress.temp_dir)
        : [];

      const chunkFile = chunkFiles[nextChunk];
      if (!chunkFile && progress?.temp_dir) {
        // Chunks may have been cleaned — re-chunk
        const manifest = await chunkAudio(resolvedPath, progress.chunk_size_seconds);
        const retryFile = manifest.chunkFiles[nextChunk];
        const diarizedRetry = await transcribeChunk(retryFile, config.mlxWhisperModel);

        markChunkProcessed(sessionDb, resolvedPath, nextChunk);
        if (sessionId && progress) {
          try {
            for (const seg of diarizedRetry.segments) {
              logTranscript(sessionDb, sessionId, seg.text, seg.speaker, "voice", "narration");
            }
          } catch {}
        }

        const remainingRetry = progress.total_chunks - nextChunk - 1;
        return {
          content: [{ type: "text", text: JSON.stringify({
            complete: false,
            chunk: nextChunk + 1,
            total_chunks: progress.total_chunks,
            segment_logged: !!sessionId,
            text: diarizedRetry.text,
            segments: diarizedRetry.segments,
            speakers_detected: diarizedRetry.speakerCount,
            note: remainingRetry > 0
              ? `Call transcribe_audio again with the same file_path and session_id to continue. ${remainingRetry} chunks remaining.`
              : undefined,
          }, null, 2) }],
        };
      }

      const diarized = await transcribeChunk(chunkFile!, config.mlxWhisperModel);

      markChunkProcessed(sessionDb, resolvedPath, nextChunk);
      if (sessionId) {
        try {
          for (const seg of diarized.segments) {
            logTranscript(sessionDb, sessionId, seg.text, seg.speaker, "voice", "narration");
          }
        } catch {}
      }

      const remaining = (progress?.total_chunks ?? 0) - nextChunk - 1;
      return {
        content: [{ type: "text", text: JSON.stringify({
          complete: false,
          chunk: nextChunk + 1,
          total_chunks: progress?.total_chunks ?? 0,
          segment_logged: !!sessionId,
          text: diarized.text,
          segments: diarized.segments,
          speakers_detected: diarized.speakerCount,
          note: remaining > 0
            ? `Call transcribe_audio again with the same file_path and session_id to continue. ${remaining} chunks remaining.`
            : undefined,
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

  // ---- Single-pass mode for short files ----
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
        segment_logged: !!(sessionId),
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

async function getFullTranscript(
  sessionDb: ReturnType<typeof openSessionDb>,
  _filePath: string,
  tempDir: string,
  sessionId?: string
): Promise<string> {
  if (sessionId) {
    const segments = getTranscript(sessionDb, sessionId, 100);
    if (segments.length > 0) {
      return segments
        .reverse()
        .map((s) => s.text)
        .join(" ");
    }
  }
  // Fallback if no DB segments
  const config = loadConfig();
  const chunkFiles = getChunkFiles(tempDir);
  const texts: string[] = [];
  for (const chunkFile of chunkFiles) {
    const d = await transcribeChunk(chunkFile, config.mlxWhisperModel);
    texts.push(d.text);
  }
  return texts.join(" ");
}
