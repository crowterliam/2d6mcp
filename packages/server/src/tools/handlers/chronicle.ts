// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  extractCandidatesHeuristic,
  parseExtractedCandidates,
  renderChronicleMarkdown,
  EXTRACT_SYSTEM_PROMPT,
  type ExtractCandidateSet,
  type BeatSource,
} from "@2d6mcp/spacetime";
import { loadConfig } from "../../config.js";
import { sessionStore, getSession, getTranscript } from "../../session/database.js";
import { synthesizeRuling as mlxSynthesizeRuling } from "../../rulings/mlx-synthesize.js";
import { resolveChronicleExportPath } from "../../chronicle/export-path.js";

export const CHRONICLE_ACTIONS = [
  "upsert_thread",
  "list_threads",
  "get_thread",
  "add_beat",
  "list_beats",
  "upsert_entity",
  "list_entities",
  "get_entity",
  "link",
  "unlink",
  "upsert_hook",
  "list_hooks",
  "brief",
  "promote",
  "search",
  "extract_candidates",
  "export",
] as const;

export type ChronicleAction = (typeof CHRONICLE_ACTIONS)[number];

function isChronicleAction(value: string): value is ChronicleAction {
  return (CHRONICLE_ACTIONS as readonly string[]).includes(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function jsonResult(payload: unknown, isError = false): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError: isError || undefined,
  };
}

function errorResult(message: string) {
  return jsonResult({ error: message }, true);
}

export function sessionCandidateBeats(
  sessionId: string,
  preferSummary: boolean
): ExtractCandidateSet | { skipped: string } {
  const db = sessionStore();
  const session = getSession(db, sessionId);
  if (!session) return { skipped: `Session not found: ${sessionId}` };
  if (!session.table_label) return { skipped: "session has no table_label; chronicle is scoped by table_label" };
  const segments = getTranscript(db, sessionId, 500);
  const transcriptText = segments
    .slice()
    .reverse()
    .map((row) => `${row.speaker ? `${row.speaker}: ` : ""}${row.text}`)
    .join("\n");
  const source: BeatSource = preferSummary && session.summary ? "from_summary" : "from_transcript";
  const text = source === "from_summary" && session.summary ? session.summary : transcriptText;
  if (!text.trim()) return { skipped: "No transcript or summary to extract" };
  return extractCandidatesHeuristic(session.table_label, text, source, sessionId);
}

export async function handleChronicle(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const action = asString(args?.action);
  if (!isChronicleAction(action)) {
    return errorResult(`action must be one of ${CHRONICLE_ACTIONS.join(", ")}`);
  }

  const db = sessionStore();
  const tableLabel = asString(args?.table_label);

  try {
    switch (action) {
      case "upsert_thread": {
        if (!tableLabel) return errorResult("table_label is required");
        const title = asString(args?.title);
        if (!title && !asString(args?.id)) return errorResult("title is required");
        const thread = db.upsertThread({
          id: asString(args?.id) || undefined,
          table_label: tableLabel,
          title: title || "untitled",
          status: asString(args?.status) || undefined,
          priority: asNumber(args?.priority),
          summary: typeof args?.summary === "string" ? args.summary : undefined,
          opened_session_id: asString(args?.opened_session_id) || undefined,
          resolved_session_id: asString(args?.resolved_session_id) || undefined,
          tags: asStringList(args?.tags),
        });
        return jsonResult(thread);
      }
      case "list_threads": {
        if (!tableLabel) return errorResult("table_label is required");
        return jsonResult({ threads: db.listThreads(tableLabel, asString(args?.status) || undefined) });
      }
      case "get_thread": {
        const id = asString(args?.id) || asString(args?.thread_id);
        if (!id) return errorResult("id is required");
        const thread = db.getThread(id);
        if (!thread) return errorResult(`Thread not found: ${id}`);
        if (tableLabel && thread.table_label.toLocaleLowerCase() !== tableLabel.toLocaleLowerCase()) {
          return errorResult(`Thread not found: ${id}`);
        }
        const beats = db.listBeats({ table_label: thread.table_label, thread_id: thread.id, limit: 40 });
        return jsonResult({ thread, beats });
      }
      case "add_beat": {
        const text = asString(args?.text);
        if (!text) return errorResult("text is required");
        const beat = db.addBeat({
          table_label: tableLabel || undefined,
          thread_id: asString(args?.thread_id) || undefined,
          session_id: asString(args?.session_id) || undefined,
          at: asNumber(args?.at),
          kind: asString(args?.kind) || undefined,
          text,
          source: asString(args?.source) || "manual",
          confidence: asString(args?.confidence) || undefined,
        });
        return jsonResult(beat);
      }
      case "list_beats": {
        if (!tableLabel) return errorResult("table_label is required");
        return jsonResult({
          beats: db.listBeats({
            table_label: tableLabel,
            thread_id: asString(args?.thread_id) || undefined,
            session_id: asString(args?.session_id) || undefined,
            kind: asString(args?.kind) || undefined,
            since: asNumber(args?.since),
            limit: asNumber(args?.limit) ?? 50,
          }),
        });
      }
      case "upsert_entity": {
        if (!tableLabel) return errorResult("table_label is required");
        const name = asString(args?.name);
        if (!name && !asString(args?.id)) return errorResult("name is required");
        const entity = db.upsertEntity({
          id: asString(args?.id) || undefined,
          table_label: tableLabel,
          type: asString(args?.type) || undefined,
          name: name || "unnamed",
          aliases: asStringList(args?.aliases),
          status: asString(args?.status) || undefined,
          notes: typeof args?.notes === "string" ? args.notes : undefined,
          last_seen_session_id: asString(args?.last_seen_session_id) || undefined,
          confidence: asString(args?.confidence) || undefined,
        });
        return jsonResult(entity);
      }
      case "list_entities": {
        if (!tableLabel) return errorResult("table_label is required");
        return jsonResult({ entities: db.listEntities(tableLabel, asString(args?.type) || undefined) });
      }
      case "get_entity": {
        const id = asString(args?.id) || asString(args?.entity_id);
        if (!id) return errorResult("id is required");
        const entity = db.getEntity(id);
        if (!entity) return errorResult(`Entity not found: ${id}`);
        if (tableLabel && entity.table_label.toLocaleLowerCase() !== tableLabel.toLocaleLowerCase()) {
          return errorResult(`Entity not found: ${id}`);
        }
        const links = db.listLinks(entity.table_label).filter((row) => row.from_id === id || row.to_id === id);
        return jsonResult({ entity, links });
      }
      case "link": {
        if (!tableLabel) return errorResult("table_label is required");
        const fromId = asString(args?.from_id);
        const toId = asString(args?.to_id);
        const rel = asString(args?.rel);
        if (!fromId || !toId || !rel) return errorResult("from_id, to_id, and rel are required");
        return jsonResult(db.link(tableLabel, fromId, toId, rel, asString(args?.note) || undefined));
      }
      case "unlink": {
        if (!tableLabel) return errorResult("table_label is required");
        const removed = db.unlink(
          tableLabel,
          asString(args?.id) || undefined,
          asString(args?.from_id) || undefined,
          asString(args?.to_id) || undefined,
          asString(args?.rel) || undefined
        );
        return jsonResult({ removed });
      }
      case "upsert_hook": {
        if (!tableLabel) return errorResult("table_label is required");
        const text = asString(args?.text);
        if (!text && !asString(args?.id)) return errorResult("text is required");
        return jsonResult(
          db.upsertHook({
            id: asString(args?.id) || undefined,
            table_label: tableLabel,
            text: text || "hook",
            status: asString(args?.status) || undefined,
            thread_id: asString(args?.thread_id) || undefined,
          })
        );
      }
      case "list_hooks": {
        if (!tableLabel) return errorResult("table_label is required");
        return jsonResult({ hooks: db.listHooks(tableLabel, asString(args?.status) || undefined) });
      }
      case "brief": {
        if (!tableLabel) return errorResult("table_label is required");
        const brief = db.brief(tableLabel, asNumber(args?.limit) ?? 12);
        return jsonResult(brief);
      }
      case "promote": {
        if (!tableLabel) return errorResult("table_label is required");
        const ids = asStringList(args?.ids) ?? [];
        const single = asString(args?.id);
        if (single) ids.push(single);
        if (ids.length === 0) return errorResult("ids is required");
        return jsonResult(db.promote(tableLabel, ids));
      }
      case "search": {
        if (!tableLabel) return errorResult("table_label is required");
        const query = asString(args?.query);
        if (!query) return errorResult("query is required");
        return jsonResult({ query, hits: db.searchChronicle(tableLabel, query, asNumber(args?.limit) ?? 30) });
      }
      case "extract_candidates": {
        return handleExtract(args);
      }
      case "export": {
        if (!tableLabel) return errorResult("table_label is required");
        const brief = db.brief(tableLabel);
        const markdown = renderChronicleMarkdown(brief);
        const path = asString(args?.path);
        if (!path) {
          return jsonResult({ markdown, note: "Draft markdown only. Pass path to write an allowlisted local file." });
        }
        const resolved = resolveChronicleExportPath(path);
        if (!resolved.ok) return errorResult(resolved.message);
        mkdirSync(dirname(resolved.path), { recursive: true });
        writeFileSync(resolved.path, markdown, "utf8");
        return jsonResult({ path: resolved.path, bytes: markdown.length, note: "Draft export written. No Discord auto-post." });
      }
      default: {
        const _never: never = action;
        return errorResult(`Unhandled action: ${_never}`);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "chronicle failed";
    return errorResult(message);
  }
}

async function handleExtract(args: Record<string, unknown> | undefined) {
  const db = sessionStore();
  const sessionId = asString(args?.session_id) || undefined;
  const tableLabelArg = asString(args?.table_label);
  const write = args?.write === true;
  const useLlm = args?.use_llm === true;
  let tableLabel = tableLabelArg;
  let source: BeatSource = "agent";
  let text = asString(args?.text) || asString(args?.summary);

  if (sessionId) {
    const session = getSession(db, sessionId);
    if (!session) return errorResult(`Session not found: ${sessionId}`);
    tableLabel = tableLabel || session.table_label || "";
    if (!text) {
      if (session.summary) {
        text = session.summary;
        source = "from_summary";
      } else {
        const segments = getTranscript(db, sessionId, 500);
        text = segments
          .slice()
          .reverse()
          .map((row) => `${row.speaker ? `${row.speaker}: ` : ""}${row.text}`)
          .join("\n");
        source = "from_transcript";
      }
    }
  }

  if (!tableLabel) return errorResult("table_label is required (or a session with table_label)");
  if (!text) return errorResult("text, summary, or session_id with transcript is required");

  let candidates: ExtractCandidateSet;
  if (useLlm) {
    try {
      const result = await mlxSynthesizeRuling(text, undefined, {
        maxTokens: 1024,
        temperature: 0.2,
        systemPrompt: EXTRACT_SYSTEM_PROMPT,
        qualityFilter: false,
      });
      candidates = parseExtractedCandidates(tableLabel, result.response, source, sessionId);
      candidates.llm_used = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "LLM unavailable";
      candidates = extractCandidatesHeuristic(tableLabel, text, source, sessionId);
      candidates.note = `LLM extract failed (${message}); heuristic fallback. All rows provisional.`;
    }
  } else {
    candidates = extractCandidatesHeuristic(tableLabel, text, source, sessionId);
  }

  const applied = db.applyExtracted(candidates, write);
  return jsonResult({
    ...applied,
    written: write,
    canon: "provisional_only",
    note: write
      ? "Wrote provisional rows. Call chronicle promote after operator review."
      : "Candidates only — not written. Pass write=true to store as provisional.",
  });
}
