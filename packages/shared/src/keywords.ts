// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "i", "you", "he",
  "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
  "your", "his", "its", "our", "their", "mine", "yours", "hers", "ours",
  "theirs", "this", "that", "these", "those", "what", "which", "who",
  "whom", "when", "where", "why", "how", "all", "each", "every", "both",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "because",
  "but", "and", "or", "if", "while", "of", "at", "by", "for", "with",
  "about", "into", "through", "during", "before", "after", "above",
  "below", "to", "from", "up", "down", "in", "out", "on", "off", "over",
  "under", "again", "further", "then", "once", "here", "there", "now",
  "also", "any",
]);

export function extractKeywords(text: string): string {
  return text.toLowerCase()
    .replace(/[?.,!;:'"()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .join(" ");
}

export function extractKeywordList(text: string): string[] {
  return text.toLowerCase()
    .replace(/[?.,!;:'"()]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function deduplicateBy<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatSizeForLog(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Compute the Optimal String Alignment (OSA) distance between two strings.
 *
 * This is a restricted form of Damerau-Levenshtein that counts adjacent
 * transpositions as a single edit (unlike classic Levenshtein, which scores
 * a transposition as 2 substitutions). OSA is the standard metric for
 * spell-checking and fuzzy search.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let v0 = new Array(n + 1);
  let v1 = new Array(n + 1);
  let v2 = new Array(n + 1);
  for (let j = 0; j <= n; j++) v0[j] = j;

  for (let i = 1; i <= m; i++) {
    v1[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      v1[j] = Math.min(
        v0[j] + 1,        // deletion
        v1[j - 1] + 1,    // insertion
        v0[j - 1] + cost, // substitution
      );
      // Transposition (counts as 1 edit if both adjacent chars are swapped)
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        v1[j] = Math.min(v1[j], v2[j - 2] + 1);
      }
    }
    [v0, v1, v2] = [v1, v2, v0];
  }
  return v0[n];
}

export function fuzzyAlternatives(word: string, maxDist: number = 1): string[] {
  if (word.length <= 3) return [];

  const alts = new Set<string>();

  const confusions: Record<string, string[]> = {
    a: ["o"], o: ["a"],
    e: ["i"], i: ["e"],
    n: ["m"], m: ["n"],
    t: ["d"], d: ["t"],
    p: ["b"], b: ["p"],
    k: ["c"], c: ["k", "s"],
    r: ["l"], l: ["r"],
    f: ["v"], v: ["f"],
  };

  for (let i = 0; i < word.length; i++) {
    const ch = word[i];
    // Deletion (remove one character)
    alts.add(word.substring(0, i) + word.substring(i + 1));
    // Common phonetic substitution (STT/typo confusions)
    const replacements = confusions[ch] || [];
    for (const rep of replacements) {
      alts.add(word.substring(0, i) + rep + word.substring(i + 1));
    }
    // Transposition (swap adjacent characters) — catches typos like "lasre"→"laser"
    if (i < word.length - 1) {
      alts.add(word.substring(0, i) + word[i + 1] + ch + word.substring(i + 2));
    }
  }

  return [...alts].filter((w) => w !== word && levenshtein(word, w) <= maxDist);
}

export function fuzzyKeywordList(keywords: string[]): string[] {
  const base = keywords.filter((w) => w.length > 0);
  const fuzzy = new Set<string>();

  for (const kw of keywords) {
    if (kw.length <= 3) continue;
    for (const alt of fuzzyAlternatives(kw)) {
      if (alt !== kw) fuzzy.add(alt);
    }
  }

  return [...base, ...fuzzy];
}

// ---- FTS5 query building for fuzzy search ----

const FTS5_SPECIAL_CHARS = /[*"()^]/g;

export function sanitizeFts5Query(term: string): string {
  let cleaned = term.replace(/[\x00-\x1F\x7F]/g, "").trim();
  if (!cleaned) return "";

  // Preserve quoted phrases
  cleaned = cleaned.replace(/"(?:(?!").)*"/g, (m) => m);

  // Normalise stray wildcards outside quotes
  const outsideQuotes = cleaned.replace(/"(?:(?!").)*"/g, "");
  if (outsideQuotes.includes("*")) {
    cleaned = cleaned
      .replace(/(\S)\*+/g, "$1*")
      .replace(/\*(\S)/g, "* $1");
  }

  // Remove FTS5 operators that are invalid inside a token (parens, caret)
  cleaned = cleaned.replace(/[()^]/g, "");

  return cleaned.trim();
}

/**
 * Build a prefix-wildcard FTS5 query from a search term.
 * Each token gets a trailing `*` so "laser rifl" matches "laser rifle".
 * Returns null if no usable tokens remain after sanitisation.
 */
export function buildPrefixFtsQuery(searchTerm: string): string | null {
  const safe = sanitizeFts5Query(searchTerm);
  if (!safe) return null;

  const tokens = safe
    .split(/\s+/)
    .map((t) => t.replace(FTS5_SPECIAL_CHARS, ""))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return null;

  return tokens.map((t) => `${t}*`).join(" ");
}

/**
 * Build a fuzzy FTS5 OR query from a search term.
 *
 * Expands each keyword (>3 chars) into its fuzzy alternatives and joins
 * everything with OR. The original tokens are included first so they rank
 * higher. Returns null if there is nothing to expand.
 *
 * Example: "laser" → "laser OR laser* OR lasre OR lase* OR lase OR ..."
 */
export function buildFuzzyFtsQuery(searchTerm: string): string | null {
  const keywords = extractKeywordList(searchTerm);
  if (keywords.length === 0) return null;

  const parts = new Set<string>();

  for (const kw of keywords) {
    if (kw.length <= 2) continue;
    // Original token (exact match)
    parts.add(kw);
    // Prefix wildcard
    parts.add(`${kw}*`);
    // Fuzzy expansions (transpositions, deletions, substitutions)
    if (kw.length > 3) {
      for (const alt of fuzzyAlternatives(kw)) {
        parts.add(alt);
        parts.add(`${alt}*`);
      }
    }
  }

  if (parts.size === 0) return null;

  return [...parts].join(" OR ");
}

/**
 * Generate LIKE-pattern variants for a search term, including fuzzy expansions.
 *
 * Returns the patterns WITHOUT surrounding % — the caller adds them. This
 * lets the caller combine multiple columns efficiently. Each variant is
 * lowercased.
 *
 * Example: "laser" → ["laser", "lasre", "lase"]
 */
export function fuzzyLikeVariants(searchTerm: string): string[] {
  const keywords = extractKeywordList(searchTerm);
  if (keywords.length === 0) {
    // Fall back to raw lowercased term for short words
    const raw = searchTerm.toLowerCase().trim();
    return raw ? [raw] : [];
  }

  const variants = new Set<string>();
  for (const kw of keywords) {
    variants.add(kw);
    if (kw.length > 3) {
      for (const alt of fuzzyAlternatives(kw)) {
        variants.add(alt);
      }
    }
  }

  return [...variants];
}

/**
 * Build an ordered list of FTS5 MATCH queries to try for a search term.
 *
 * Strategies are attempted in order of decreasing precision:
 *   1. Exact phrase / token match
 *   2. Prefix wildcard (token*) — catches partial words ("rifl" → "rifle")
 *   3. Fuzzy OR expansion — catches typos/STT errors ("lasre" → "laser")
 *
 * Duplicate and empty queries are removed. Callers should iterate and stop
 * at the first query that yields results.
 */
export function fts5QueryStrategy(searchTerm: string): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  const add = (q: string | null) => {
    if (q && !seen.has(q)) {
      seen.add(q);
      queries.push(q);
    }
  };

  add(sanitizeFts5Query(searchTerm));
  add(buildPrefixFtsQuery(searchTerm));
  add(buildFuzzyFtsQuery(searchTerm));

  return queries;
}

/**
 * Run a search with fuzzy fallback. Database-agnostic: the caller provides an
 * executor that takes a lowercased term and returns results.
 *
 * Strategy: try the exact term first. If it returns nothing, expand to fuzzy
 * variants and collect deduplicated results across all variants.
 *
 * @param searchTerm The raw user search term
 * @param executor A function that takes a lowercase term and returns results
 * @param keyFn Optional dedup key function (defaults to JSON.stringify)
 */
export function searchWithFuzzyFallback<T>(
  searchTerm: string,
  executor: (term: string) => T[],
  keyFn: (item: T) => string = (item) => JSON.stringify(item),
): T[] {
  const lower = searchTerm.toLowerCase().trim();
  if (!lower) return [];

  // Exact match first — short-circuit if found
  const exact = executor(lower);
  if (exact.length > 0) return exact;

  // Fuzzy fallback: try each variant and accumulate deduplicated results
  const variants = fuzzyLikeVariants(searchTerm);
  const seen = new Set<string>();
  const results: T[] = [];

  for (const variant of variants) {
    if (variant === lower) continue;
    const variantResults = executor(variant);
    for (const r of variantResults) {
      const key = keyFn(r);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(r);
      }
    }
  }

  return results;
}
