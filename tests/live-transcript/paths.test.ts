/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { splitEnvPathList, companionDbCandidates } from "../../packages/server/src/live-transcript/paths.js";

describe("live transcript path helpers", () => {
  it("splits colon and semicolon lists without breaking Windows drives", () => {
    expect(splitEnvPathList("C:\\Users\\me\\db;D:/notes")).toEqual([
      "C:\\Users\\me\\db",
      "D:/notes",
    ]);
    expect(splitEnvPathList("/tmp/a:/tmp/b")).toEqual(["/tmp/a", "/tmp/b"]);
    expect(splitEnvPathList("  /one ; /two : /three  ")).toEqual(["/one", "/two", "/three"]);
    expect(splitEnvPathList("")).toEqual([]);
  });

  it("lists companion db candidates under app-data locations", () => {
    const candidates = companionDbCandidates();
    expect(candidates.some((p) => p.endsWith(join("app.opengranola", "library", "opengranola.db")))).toBe(
      true
    );
  });
});
