/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

describe("licensing firewall", () => {
  it("rejects vendored PDFs and forbidden identifiers", () => {
    const script = resolve("scripts/license-firewall.mjs");
    const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
    expect(output).toContain("Licensing firewall: ok");
  });
});
