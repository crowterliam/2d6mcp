/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLOSED_TITLE_FRAGMENTS = [
  ["Old-School", " Essentials"],
  ["Necrotic", " Gnome"],
  ["AF", " Tomes"],
  ["Advanced Fantasy", " Tomes"],
  ["Black", " Streams"],
  ["Mongoose", " CRB"],
  ["Masks of", " Nyar"],
];

describe("licensing firewall", () => {
  it("rejects vendored PDFs, book dumps, and closed-content identifiers", () => {
    const script = resolve("scripts/license-firewall.mjs");
    const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
    expect(output).toContain("Licensing firewall: ok");
  });

  it("keeps closed-content titles split in the scanner source", () => {
    const src = readFileSync(resolve("scripts/license-firewall.mjs"), "utf8");
    for (const title of CLOSED_TITLE_FRAGMENTS.map((parts) => parts.join(""))) {
      expect(src.includes(title)).toBe(false);
      expect(src.toLowerCase().includes(title.toLowerCase())).toBe(false);
    }
  });

  it("does not name closed-content titles in public license docs", () => {
    for (const rel of ["LICENSE.md", "AI-POLICY.md", "README.md", "data/osr/NOTICE.txt"]) {
      const text = readFileSync(resolve(rel), "utf8");
      for (const title of CLOSED_TITLE_FRAGMENTS.map((parts) => parts.join(""))) {
        expect(text.includes(title)).toBe(false);
        expect(text.toLowerCase().includes(title.toLowerCase())).toBe(false);
      }
    }
  });
});
