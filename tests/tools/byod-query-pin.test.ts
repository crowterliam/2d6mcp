/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleQueryLocalByod } from "../../packages/server/src/tools/handlers/byod.js";
import { closeByodDatabase } from "../../packages/server/src/byod/search.js";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-byod-pin-${Date.now()}`);

describe("query_local_byod path pin", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.AGREE_BYOD_USE = "true";
    mkdirSync(TMP, { recursive: true });
  });

  afterEach(() => {
    closeByodDatabase();
    process.env = { ...originalEnv };
    rmSync(TMP, { recursive: true, force: true });
  });

  it("indexes and searches only the pinned nested folder", async () => {
    const byodPath = join(TMP, "shelf");
    mkdirSync(join(byodPath, "parent", "line"), { recursive: true });
    mkdirSync(join(byodPath, "parent", "edition-5-sibling"), { recursive: true });
    writeFileSync(join(byodPath, "parent", "line", "core.txt"), "qzzvlinecore printed target ten");
    writeFileSync(
      join(byodPath, "parent", "edition-5-sibling", "zine.txt"),
      "qzzvsiblingzine sibling edition text"
    );
    process.env.BYOD_PATH = byodPath;

    const result = await handleQueryLocalByod({
      search_term: "qzzvlinecore",
      root: join("parent", "line"),
    });
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse(result.content[0].text) as {
      matched_roots: string[];
      results: Array<{ snippet: string; filePath: string }>;
    };
    expect(payload.matched_roots.map((p) => p.replace(/\\/g, "/"))).toEqual(["parent/line"]);
    expect(payload.results.some((r) => /qzzvlinecore/i.test(r.snippet))).toBe(true);

    const sibling = await handleQueryLocalByod({
      search_term: "qzzvsiblingzine",
      root: join("parent", "line"),
    });
    const siblingPayload = JSON.parse(sibling.content[0].text) as { results: unknown[] };
    expect(siblingPayload.results).toHaveLength(0);
  });
});
