// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export type TranscriptSearchMode = "phrase" | "and";

export interface ParsedTranscriptQuery {
  mode: TranscriptSearchMode;
  terms: string[];
}

export function escapeLikeTerm(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function unwrapQuoted(text: string): string | null {
  if (text.length < 2) return null;
  const start = text[0];
  const end = text[text.length - 1];
  if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
    return text.slice(1, -1);
  }
  return null;
}

export function parseTranscriptSearchQuery(query: string): ParsedTranscriptQuery {
  const trimmed = query.trim();
  const quoted = unwrapQuoted(trimmed);
  if (quoted !== null) {
    const phrase = quoted.trim();
    return { mode: "phrase", terms: phrase ? [phrase] : [] };
  }
  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length <= 1) {
    return { mode: "phrase", terms };
  }
  return { mode: "and", terms };
}

function toSearchable(value: string): string {
  return value.toLocaleLowerCase();
}

export function textMatchesQuery(text: string, query: string): boolean {
  const parsed = parseTranscriptSearchQuery(query);
  if (parsed.terms.length === 0) return false;
  const hay = toSearchable(text);
  if (parsed.mode === "phrase") {
    return hay.includes(toSearchable(parsed.terms[0] ?? ""));
  }
  return parsed.terms.every((term) => hay.includes(toSearchable(term)));
}
