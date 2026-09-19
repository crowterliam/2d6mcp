/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { close5ecompatibleDatabase } from "@2d6mcp/5ecompatible/database";
import { populate5ecompatibleDatabase, resolveCompiledSrdPath } from "@2d6mcp/5ecompatible/populate";

const COMPILED_STEM = "dnd_srd_5.2.1_compiled";

const FIXTURE_MARKDOWN = [
  "# Playing the Game",
  "",
  "Original fixture text for compiled-path resolution tests.",
  "",
  "## Ability Checks",
  "",
  "Roll a twenty-sided die and add the relevant modifier to resolve a task.",
  "",
  "## Saving Throws",
  "",
  "Roll a twenty-sided die and add the relevant save when resisting an effect.",
  "",
].join("\n");

const TEMP_ROOTS: string[] = [];

function makeTempRoot(label: string): string {
  const root = join(tmpdir(), `2d6mcp-sr5e-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  TEMP_ROOTS.push(root);
  return root;
}

function writeCompiled(srdRoot: string, relativePath: string, contents = FIXTURE_MARKDOWN): string {
  const fullPath = join(srdRoot, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, contents);
  return fullPath;
}

function countSections(dbPath: string): number {
  const db = new Database(dbPath, { readonly: true });
  try {
    return (db.prepare("SELECT COUNT(*) AS c FROM sr5e_sections").get() as { c: number }).c;
  } finally {
    db.close();
  }
}

afterEach(() => {
  close5ecompatibleDatabase();
  while (TEMP_ROOTS.length > 0) {
    const root = TEMP_ROOTS.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe("resolveCompiledSrdPath", () => {
  it("prefers the current upstream .md file", () => {
    const srd = makeTempRoot("md-only");
    const mdPath = writeCompiled(srd, join("docs_compiled", `${COMPILED_STEM}.md`));

    expect(resolveCompiledSrdPath(srd)).toBe(mdPath);
  });

  it("falls back to the extensionless compiled file", () => {
    const srd = makeTempRoot("bare-file");
    const barePath = writeCompiled(srd, join("docs_compiled", COMPILED_STEM));

    expect(resolveCompiledSrdPath(srd)).toBe(barePath);
  });

  it("prefers the .md file when both layouts are present", () => {
    const srd = makeTempRoot("both");
    const mdPath = writeCompiled(srd, join("docs_compiled", `${COMPILED_STEM}.md`), "# From markdown\n\n## Topic\n");
    writeCompiled(srd, join("docs_compiled", COMPILED_STEM), "# From bare file\n\n## Topic\n");

    expect(resolveCompiledSrdPath(srd)).toBe(mdPath);
  });

  it("falls back to a compiled directory when that is the only layout", () => {
    const srd = makeTempRoot("bare-dir");
    const nested = writeCompiled(srd, join("docs_compiled", COMPILED_STEM, `${COMPILED_STEM}.md`));

    expect(resolveCompiledSrdPath(srd)).toBe(nested);
  });

  it("returns the compiled directory when it contains other markdown files", () => {
    const srd = makeTempRoot("dir-chapters");
    const compiledDir = join(srd, "docs_compiled", COMPILED_STEM);
    writeCompiled(srd, join("docs_compiled", COMPILED_STEM, "chapter-a.md"));

    expect(resolveCompiledSrdPath(srd)).toBe(compiledDir);
  });

  it("returns null when no compiled source is present", () => {
    const srd = makeTempRoot("missing");
    mkdirSync(join(srd, "docs_compiled"), { recursive: true });

    expect(resolveCompiledSrdPath(srd)).toBeNull();
  });
});

describe("populate5ecompatibleDatabase compiled sections", () => {
  it("seeds sr5e_sections from a .md-only compiled tree", () => {
    const root = makeTempRoot("populate-md");
    const srd = join(root, "srd");
    const dbPath = join(root, "5ecompatible-srd.db");
    writeCompiled(srd, join("docs_compiled", `${COMPILED_STEM}.md`));

    const result = populate5ecompatibleDatabase(dbPath, srd);

    expect(result.success).toBe(true);
    expect(countSections(dbPath)).toBeGreaterThan(0);
  });

  it("seeds sr5e_sections from an extensionless compiled file", () => {
    const root = makeTempRoot("populate-bare");
    const srd = join(root, "srd");
    const dbPath = join(root, "5ecompatible-srd.db");
    writeCompiled(srd, join("docs_compiled", COMPILED_STEM));

    const result = populate5ecompatibleDatabase(dbPath, srd);

    expect(result.success).toBe(true);
    expect(countSections(dbPath)).toBeGreaterThan(0);
  });

  it("seeds sr5e_sections from a compiled directory of markdown files", () => {
    const root = makeTempRoot("populate-dir");
    const srd = join(root, "srd");
    const dbPath = join(root, "5ecompatible-srd.db");
    writeCompiled(srd, join("docs_compiled", COMPILED_STEM, "chapter-a.md"));

    const result = populate5ecompatibleDatabase(dbPath, srd);

    expect(result.success).toBe(true);
    expect(countSections(dbPath)).toBeGreaterThan(0);
  });
});
