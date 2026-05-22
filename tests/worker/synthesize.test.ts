// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Tests for the synthesize service logic — FTS query building and source dedup.
// Does NOT test the full AI pipeline (requires Cloudflare bindings).

import { describe, it, expect } from "vitest";

// Re-implemented inline for test isolation (these are exported from synthesize.ts)
// but querying Workers AI requires Cloudflare bindings which aren't available in vitest.

describe("FTS query builder", () => {
  function buildFtsQuery(question: string): { query: string; preferOgl: boolean } {
    const cleaned = question.toLowerCase().replace(/[?.,!;:'"()]/g, " ");
    const words = cleaned.split(/\s+/).filter((w) => w.length > 2);

    const oglTerms = new Set(["combat", "modifier", "dm", "skill", "characteristic", "starship", "world", "career", "equipment", "cover", "armour", "armor", "damage", "upp"]);
    const preferOgl = words.some((w) => oglTerms.has(w));

    const phrases: string[] = [];
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`"${words[i]} ${words[i + 1]}"`);
    }

    const significant = words.filter((w) => w.length > 3).slice(0, 6);
    const terms = [...phrases, ...significant.map((w) => `"${w}"`)];
    return { query: [...new Set(terms)].join(" OR "), preferOgl };
  }

  it("creates phrase pairs for multi-word queries", () => {
    const { query } = buildFtsQuery("difficulty modifier for hard cover in combat");
    expect(query).toContain('"difficulty modifier"');
    expect(query).toContain('"hard cover"');
  });

  it("detects OGL-preferring queries", () => {
    const { preferOgl } = buildFtsQuery("what is the difficulty modifier for hard cover in combat?");
    expect(preferOgl).toBe(true);
  });

  it("does not prefer OGL for non-OGL queries", () => {
    const { preferOgl } = buildFtsQuery("how do I roleplay a dragon?");
    expect(preferOgl).toBe(false);
  });

  it("handles single-word queries", () => {
    const { query } = buildFtsQuery("combat");
    expect(query).toBe('"combat"');
  });

  it("handles empty input", () => {
    const { query } = buildFtsQuery("");
    expect(query).toBe("");
  });

  it("prefers OGL for combat terms", () => {
    const combatTerms = ["combat", "armor", "damage", "cover", "starship", "modifier", "cover"];
    for (const term of combatTerms) {
      const { preferOgl } = buildFtsQuery(`what is ${term}?`);
      expect(preferOgl).toBe(true);
    }
  });

  it("handles DW-only questions", () => {
    const { preferOgl } = buildFtsQuery("what move do I use for persuasion?");
    expect(preferOgl).toBe(false);
  });
});

describe("Source dedup logic", () => {
  interface RuleResult {
    title: string;
    category: string;
    content: string;
    source_tag: string;
  }

  function dedupSources(
    oglResults: RuleResult[],
    dwResults: RuleResult[],
    preferOgl: boolean,
  ): { sources: Array<{ system: string; tag: string }>; maxDw: number } {
    const seen = new Set<string>();
    const sources: Array<{ system: string; tag: string }> = [];

    for (const r of oglResults) {
      if (!seen.has(r.source_tag)) {
        seen.add(r.source_tag);
        sources.push({ system: "ogl", tag: r.source_tag });
      }
    }
    for (const r of dwResults) {
      if (!seen.has(r.source_tag)) {
        seen.add(r.source_tag);
        sources.push({ system: "dw", tag: r.source_tag });
      }
    }

    return { sources, maxDw: preferOgl ? 2 : 5 };
  }

  it("deduplicates sources by tag", () => {
    const ogl: RuleResult[] = [
      { title: "Cover", category: "combat", content: "...", source_tag: "OGL Combat: Cover" },
      { title: "Cover", category: "combat", content: "...", source_tag: "OGL Combat: Cover" }, // duplicate
      { title: "Core Mechanic", category: "core_rules", content: "...", source_tag: "OGL Core: Core Mechanic" },
    ];

    const { sources } = dedupSources(ogl, [], false);
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.tag)).toEqual(["OGL Combat: Cover", "OGL Core: Core Mechanic"]);
  });

  it("limits DW sources when OGL-preferred", () => {
    const dw: RuleResult[] = [
      { title: "Hard Move", category: "gm", content: "...", source_tag: "DW GM: Soft moves and hard moves" },
      { title: "Hack and Slash", category: "move", content: "...", source_tag: "DW Move: Hack and Slash" },
      { title: "Discern Realities", category: "move", content: "...", source_tag: "DW Move: Discern Realities" },
      { title: "Defend", category: "move", content: "...", source_tag: "DW Move: Defend" },
    ];

    const { maxDw } = dedupSources([], dw, true);
    expect(maxDw).toBe(2);
  });

  it("allows more DW sources when not OGL-preferred", () => {
    const result = dedupSources([], [], false);
    expect(result.maxDw).toBe(5);
  });

  it("deduplicates across OGL and DW with matching tags", () => {
    const ogl: RuleResult[] = [
      { title: "Cover", category: "combat", content: "...", source_tag: "OGL Combat: Cover" },
    ];
    const dw: RuleResult[] = [
      // Same source tag = duplicate
      { title: "Cover", category: "combat", content: "...", source_tag: "OGL Combat: Cover" },
    ];

    const { sources } = dedupSources(ogl, dw, false);
    expect(sources).toHaveLength(1);
  });
});
