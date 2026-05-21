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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let v0 = new Array(n + 1);
  let v1 = new Array(n + 1);
  for (let i = 0; i <= n; i++) v0[i] = i;
  for (let i = 1; i <= m; i++) {
    v1[0] = i;
    for (let j = 1; j <= n; j++) {
      v1[j] = a[i - 1] === b[j - 1] ? v0[j - 1] : 1 + Math.min(v0[j], v1[j - 1], v0[j - 1]);
    }
    [v0, v1] = [v1, v0];
  }
  return v0[n];
}

export function fuzzyAlternatives(word: string, maxDist: number = 1): string[] {
  if (word.length <= 4) return [];

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
    alts.add(word.substring(0, i) + word.substring(i + 1));
    const replacements = confusions[ch] || [];
    for (const rep of replacements) {
      alts.add(word.substring(0, i) + rep + word.substring(i + 1));
    }
  }

  return [...alts].filter((w) => levenshtein(word, w) <= maxDist);
}

export function fuzzyKeywordList(keywords: string[]): string[] {
  const base = keywords.filter((w) => w.length > 0);
  const fuzzy = new Set<string>();

  for (const kw of keywords) {
    if (kw.length <= 4) continue;
    for (const alt of fuzzyAlternatives(kw)) {
      if (alt !== kw) fuzzy.add(alt);
    }
  }

  return [...base, ...fuzzy];
}
