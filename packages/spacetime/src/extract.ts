// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type {
  BeatKind,
  BeatSource,
  EntityType,
  ExtractCandidateSet,
  ExtractedBeat,
  ExtractedEntity,
} from "./types.js";
import { isBeatKind, isEntityType, requireTableLabel } from "./types.js";

const KIND_HINTS: Array<{ kind: BeatKind; pattern: RegExp }> = [
  { kind: "combat", pattern: /\b(fight|combat|attack|ambush|wound|kills?|initiative)\b/i },
  { kind: "loot", pattern: /\b(loot|treasure|spoils|credits|haul|salvage)\b/i },
  { kind: "travel", pattern: /\b(travel|journey|arrive|depart|jump|voyage|road)\b/i },
  { kind: "rumour", pattern: /\b(rumour|rumor|hearsay|whisper|word is)\b/i },
  { kind: "decision", pattern: /\b(decid(?:e|ed|es)|agree(?:d)?|vote|choose|chose)\b/i },
  { kind: "consequence", pattern: /\b(because|so now|fallout|consequence|aftermath)\b/i },
  { kind: "reveal", pattern: /\b(reveal|discover|found out|turns out|secret)\b/i },
];

function inferKind(text: string): BeatKind {
  for (const hint of KIND_HINTS) {
    if (hint.pattern.test(text)) return hint.kind;
  }
  return "note";
}

function inferEntityType(text: string): EntityType {
  const lower = text.toLocaleLowerCase();
  if (/\b(ship|vessel|freighter|cutter)\b/.test(lower)) return "ship";
  if (/\b(port|starport|city|town|station|world|planet)\b/.test(lower)) return "place";
  if (/\b(guild|faction|house|crew|cartel)\b/.test(lower)) return "faction";
  if (/\b(sword|pistol|relic|artifact|item)\b/.test(lower)) return "item";
  return "person";
}

export function splitCandidateLines(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line.length >= 12);
}

const NAME_RE = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g;
const STOP_NAMES = new Set([
  "The",
  "A",
  "An",
  "I",
  "We",
  "You",
  "They",
  "This",
  "That",
  "Then",
  "When",
  "After",
  "Before",
  "During",
  "Player",
  "Referee",
]);

export function extractNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(NAME_RE)) {
    const name = match[1]?.trim();
    if (!name || STOP_NAMES.has(name.split(/\s+/)[0] ?? "")) continue;
    if (name.length < 3) continue;
    names.add(name);
  }
  return [...names];
}

export function extractCandidatesHeuristic(
  tableLabel: string,
  text: string,
  source: BeatSource,
  sessionId?: string
): ExtractCandidateSet {
  const label = requireTableLabel(tableLabel);
  const lines = splitCandidateLines(text);
  const beats: ExtractedBeat[] = lines.slice(0, 24).map((line) => ({
    kind: inferKind(line),
    text: line.slice(0, 500),
    session_id: sessionId,
    source,
    confidence: "provisional",
  }));
  const entities: ExtractedEntity[] = extractNames(text)
    .slice(0, 16)
    .map((name) => ({
      type: inferEntityType(`${name} ${text}`),
      name,
      source,
      confidence: "provisional",
    }));
  return {
    table_label: label,
    session_id: sessionId ?? null,
    source,
    beats,
    entities,
    llm_used: false,
    note: "Heuristic extract. All rows are provisional until chronicle promote.",
  };
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function asBeatKind(value: unknown): BeatKind {
  return typeof value === "string" && isBeatKind(value) ? value : "note";
}

function asEntityType(value: unknown): EntityType {
  return typeof value === "string" && isEntityType(value) ? value : "other";
}

/**
 * Parse model JSON into provisional candidates. Any requested `confirmed`
 * confidence is forced back to provisional — never auto-canon.
 */
export function parseExtractedCandidates(
  tableLabel: string,
  raw: string,
  source: BeatSource,
  sessionId?: string
): ExtractCandidateSet {
  const label = requireTableLabel(tableLabel);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return extractCandidatesHeuristic(label, raw, source, sessionId);
  }
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const beatRows = Array.isArray(record.beats) ? record.beats : [];
  const entityRows = Array.isArray(record.entities) ? record.entities : [];
  const beats: ExtractedBeat[] = [];
  for (const row of beatRows) {
    if (!row || typeof row !== "object") continue;
    const text = typeof (row as { text?: unknown }).text === "string" ? (row as { text: string }).text.trim() : "";
    if (!text) continue;
    const threadId =
      typeof (row as { thread_id?: unknown }).thread_id === "string"
        ? (row as { thread_id: string }).thread_id
        : undefined;
    const beat: ExtractedBeat = {
      kind: asBeatKind((row as { kind?: unknown }).kind),
      text: text.slice(0, 500),
      source,
      confidence: "provisional",
    };
    if (threadId) beat.thread_id = threadId;
    if (sessionId) beat.session_id = sessionId;
    beats.push(beat);
  }
  const entities: ExtractedEntity[] = [];
  for (const row of entityRows) {
    if (!row || typeof row !== "object") continue;
    const name = typeof (row as { name?: unknown }).name === "string" ? (row as { name: string }).name.trim() : "";
    if (!name) continue;
    const aliasesRaw = (row as { aliases?: unknown }).aliases;
    const entity: ExtractedEntity = {
      type: asEntityType((row as { type?: unknown }).type),
      name,
      source,
      confidence: "provisional",
    };
    if (Array.isArray(aliasesRaw)) {
      entity.aliases = aliasesRaw.filter((item): item is string => typeof item === "string");
    }
    if (typeof (row as { notes?: unknown }).notes === "string") {
      entity.notes = (row as { notes: string }).notes;
    }
    entities.push(entity);
  }
  return {
    table_label: label,
    session_id: sessionId ?? null,
    source,
    beats,
    entities,
    llm_used: true,
    note: "LLM extract. All rows are provisional until chronicle promote.",
  };
}

export const EXTRACT_SYSTEM_PROMPT = [
  "Extract TTRPG chronicle candidates as JSON only.",
  'Shape: {"beats":[{"kind":"reveal|decision|combat|travel|rumour|loot|consequence|note","text":"..."}],"entities":[{"type":"person|place|faction|item|ship|other","name":"...","aliases":[],"notes":"..."}]}',
  "Use only facts present in the source text. Do not invent.",
  "Do not mark anything confirmed. The operator promotes later.",
].join("\n");
