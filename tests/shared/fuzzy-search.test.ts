import { describe, it, expect } from "vitest";
import {
  fuzzyAlternatives,
  fuzzyKeywordList,
  fuzzyLikeVariants,
  buildPrefixFtsQuery,
  buildFuzzyFtsQuery,
  fts5QueryStrategy,
  sanitizeFts5Query,
  searchWithFuzzyFallback,
  levenshtein,
  extractKeywords,
  extractKeywordList,
} from "@2d6mcp/shared";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("laser", "laser")).toBe(0);
  });

  it("counts single substitution", () => {
    expect(levenshtein("cat", "cot")).toBe(1);
  });

  it("counts adjacent transposition as 1 edit (OSA/Damerau-Levenshtein)", () => {
    expect(levenshtein("laser", "lasre")).toBe(1);
  });

  it("handles different lengths", () => {
    expect(levenshtein("abc", "abcd")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("fuzzyAlternatives", () => {
  it("returns empty for very short words", () => {
    expect(fuzzyAlternatives("ab")).toEqual([]);
    expect(fuzzyAlternatives("abc")).toEqual([]);
  });

  it("includes deletions (removing one character)", () => {
    const alts = fuzzyAlternatives("laser");
    // Removing 'r' should yield "lase"
    expect(alts).toContain("lase");
    // Removing 'l' should yield "aser"
    expect(alts).toContain("aser");
  });

  it("includes phonetic substitutions", () => {
    // a→o substitution on "battle" → "bottle"
    const alts = fuzzyAlternatives("battle");
    expect(alts).toContain("bottle");
  });

  it("includes transpositions (adjacent swap)", () => {
    const alts = fuzzyAlternatives("laser");
    // Swap 'e' and 'r' → "lasre"
    expect(alts).toContain("lasre");
    // Swap 's' and 'e' → "laesr"
    expect(alts).toContain("laesr");
  });

  it("does not include the original word", () => {
    const alts = fuzzyAlternatives("laser");
    expect(alts).not.toContain("laser");
  });

  it("respects maxDist parameter", () => {
    const alts1 = fuzzyAlternatives("testing", 1);
    const alts2 = fuzzyAlternatives("testing", 2);
    // maxDist=2 should yield at least as many variants
    expect(alts2.length).toBeGreaterThanOrEqual(alts1.length);
  });
});

describe("fuzzyKeywordList", () => {
  it("includes original keywords plus fuzzy expansions", () => {
    const result = fuzzyKeywordList(["laser", "rifle"]);
    expect(result).toContain("laser");
    expect(result).toContain("rifle");
    // Should also include fuzzy variants
    expect(result.length).toBeGreaterThan(2);
  });

  it("does not expand very short keywords", () => {
    const result = fuzzyKeywordList(["ab", "cd"]);
    expect(result).toEqual(["ab", "cd"]);
  });
});

describe("sanitizeFts5Query", () => {
  it("strips FTS5 operators", () => {
    expect(sanitizeFts5Query("combat*^()")).toBe("combat*");
  });

  it("removes control characters", () => {
    expect(sanitizeFts5Query("combat\x00test")).toBe("combattest");
  });

  it("returns empty for whitespace-only input", () => {
    expect(sanitizeFts5Query("   ")).toBe("");
  });

  it("preserves quoted phrases", () => {
    expect(sanitizeFts5Query('"phrase here"')).toBe('"phrase here"');
  });

  it("normalizes trailing wildcards", () => {
    expect(sanitizeFts5Query("laser***")).toBe("laser*");
  });
});

describe("buildPrefixFtsQuery", () => {
  it("adds prefix wildcard to each token", () => {
    expect(buildPrefixFtsQuery("laser rifle")).toBe("laser* rifle*");
  });

  it("handles single token", () => {
    expect(buildPrefixFtsQuery("combat")).toBe("combat*");
  });

  it("returns null for empty input", () => {
    expect(buildPrefixFtsQuery("")).toBeNull();
    expect(buildPrefixFtsQuery("   ")).toBeNull();
  });

  it("strips special chars before adding wildcard", () => {
    expect(buildPrefixFtsQuery("laser*")).toBe("laser*");
  });
});

describe("buildFuzzyFtsQuery", () => {
  it("includes original token and prefix", () => {
    const result = buildFuzzyFtsQuery("laser");
    expect(result).toContain("laser");
    expect(result).toContain("laser*");
  });

  it("includes fuzzy expansions", () => {
    const result = buildFuzzyFtsQuery("laser");
    expect(result).toContain("lasre"); // transposition
    expect(result).toContain("lase");   // deletion
  });

  it("joins alternatives with OR", () => {
    const result = buildFuzzyFtsQuery("laser");
    expect(result).toContain(" OR ");
  });

  it("returns null for empty input", () => {
    expect(buildFuzzyFtsQuery("")).toBeNull();
    expect(buildFuzzyFtsQuery("the")).toBeNull(); // stopword
  });

  it("handles multi-word queries", () => {
    const result = buildFuzzyFtsQuery("laser rifle");
    expect(result).toContain("laser");
    expect(result).toContain("rifle");
  });
});

describe("fts5QueryStrategy", () => {
  it("returns ordered strategies: exact, prefix, fuzzy", () => {
    const strategies = fts5QueryStrategy("laser");
    expect(strategies.length).toBe(3);
    // First should be exact (no OR, no wildcard)
    expect(strategies[0]).toBe("laser");
    // Second should be prefix wildcard
    expect(strategies[1]).toBe("laser*");
    // Third should be fuzzy (contains OR)
    expect(strategies[2]).toContain(" OR ");
  });

  it("deduplicates identical strategies", () => {
    // Short word with no fuzzy expansion: exact and prefix differ but fuzzy may be same as prefix
    const strategies = fts5QueryStrategy("ab");
    // "ab" is too short for fuzzy expansion, so should have fewer strategies
    expect(strategies.length).toBeLessThanOrEqual(2);
  });

  it("returns empty for empty input", () => {
    expect(fts5QueryStrategy("")).toEqual([]);
  });

  it("preserves multi-word exact queries", () => {
    const strategies = fts5QueryStrategy("laser rifle combat");
    expect(strategies[0]).toBe("laser rifle combat");
  });
});

describe("fuzzyLikeVariants", () => {
  it("includes original keyword", () => {
    const variants = fuzzyLikeVariants("laser");
    expect(variants).toContain("laser");
  });

  it("includes fuzzy expansions", () => {
    const variants = fuzzyLikeVariants("laser");
    expect(variants).toContain("lasre"); // transposition
    expect(variants).toContain("lase");   // deletion
  });

  it("handles multi-word terms", () => {
    const variants = fuzzyLikeVariants("laser rifle");
    expect(variants).toContain("laser");
    expect(variants).toContain("rifle");
  });

  it("falls back to raw term for short words", () => {
    const variants = fuzzyLikeVariants("ab");
    expect(variants).toContain("ab");
  });

  it("returns empty for empty input", () => {
    expect(fuzzyLikeVariants("")).toEqual([]);
  });
});

describe("searchWithFuzzyFallback", () => {
  it("returns exact results when found", () => {
    const executor = (term: string) =>
      term === "pilot" ? [{ name: "Pilot" }] : [];
    const results = searchWithFuzzyFallback("pilot", executor);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Pilot");
  });

  it("falls back to fuzzy variants when exact fails", () => {
    const executor = (term: string) =>
      term === "pilot" ? [{ name: "Pilot" }] : [];
    // "Pliot" is a typo that fuzzy-expands to "pilot"
    const results = searchWithFuzzyFallback("pliot", executor);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Pilot");
  });

  it("deduplicates results across fuzzy variants", () => {
    let callCount = 0;
    const executor = (term: string) => {
      callCount++;
      // "pliot" transposes to "pilot"; also generates "ploit", "liot" etc.
      // Match on "pilot" and "ploit" but always return the same item
      if (term === "pilot" || term === "ploit") {
        return [{ name: "Pilot" }];
      }
      return [];
    };
    const results = searchWithFuzzyFallback("pliot", executor, (r) => r.name);
    // Should only contain "Pilot" once despite matching multiple variants
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Pilot");
    expect(callCount).toBeGreaterThan(1);
  });

  it("returns empty when no variants match", () => {
    const executor = (_term: string) => [];
    const results = searchWithFuzzyFallback("xyzzyplugh", executor);
    expect(results).toEqual([]);
  });

  it("returns empty for empty search term", () => {
    const executor = (_term: string) => [{ name: "test" }];
    const results = searchWithFuzzyFallback("", executor);
    expect(results).toEqual([]);
  });

  it("uses custom key function for dedup", () => {
    const executor = (term: string) =>
      // "pliot" transposes to "pilot" and "ploit"
      term === "pilot" || term === "ploit"
        ? [{ id: 1, name: "Pilot" }]
        : [];
    const results = searchWithFuzzyFallback("pliot", executor, (r) => String(r.id));
    expect(results).toHaveLength(1);
  });
});

describe("extractKeywords / extractKeywordList", () => {
  it("removes punctuation and lowercases", () => {
    // "What's" → "whats" (apostrophe removed, not a stopword, >2 chars)
    expect(extractKeywords("What's the Combat?")).toBe("whats combat");
  });

  it("filters stopwords", () => {
    expect(extractKeywords("the and or")).toBe("");
  });

  it("filters short words", () => {
    expect(extractKeywords("a be do")).toBe("");
  });

  it("returns list for extractKeywordList", () => {
    expect(extractKeywordList("laser rifle combat")).toEqual(["laser", "rifle", "combat"]);
  });
});
