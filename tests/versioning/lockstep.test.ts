/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyVersion,
  assertLockstep,
  bumpSemver,
  collectVersionFiles,
  parseSemver,
  runCli,
} from "../../scripts/bump-version.mjs";
import { getServerVersion } from "../../packages/server/src/tools/helpers.js";
import { readResource } from "../../packages/server/src/resources.js";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts/bump-version.mjs");

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function makeFixtureRepo() {
  const dir = join(tmpdir(), `2d6mcp-version-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(dir, "packages", "shared"), { recursive: true });
  mkdirSync(join(dir, "packages", "server"), { recursive: true });
  writeJson(join(dir, "package.json"), {
    name: "2d6mcp",
    version: "0.7.0",
    private: true,
    workspaces: ["packages/*"],
  });
  writeJson(join(dir, "packages/shared/package.json"), { name: "@2d6mcp/shared", version: "0.7.0" });
  writeJson(join(dir, "packages/server/package.json"), { name: "@2d6mcp/server", version: "0.7.0" });
  writeJson(join(dir, "server.json"), {
    name: "io.github.crowterliam/2d6mcp",
    version: "0.7.0",
    packages: [{ identifier: "crowterliam-2d6mcp", version: "0.7.0" }],
  });
  writeJson(join(dir, "package-lock.json"), {
    name: "2d6mcp",
    version: "0.7.0",
    lockfileVersion: 3,
    packages: {
      "": { name: "2d6mcp", version: "0.7.0" },
      "packages/shared": { name: "@2d6mcp/shared", version: "0.7.0" },
      "packages/server": { name: "@2d6mcp/server", version: "0.7.0" },
    },
  });
  return dir;
}

describe("lockstep versioning", () => {
  it("keeps every workspace package.json on the root version", () => {
    const result = assertLockstep(ROOT);
    const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    expect(result.version).toBe(rootPkg.version);
    expect(result.records.length).toBeGreaterThan(1);
    for (const record of result.records) {
      expect(record.version).toBe(rootPkg.version);
    }
  });

  it("exposes the root package.json version on the MCP server and info resource", () => {
    const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    expect(getServerVersion()).toBe(rootPkg.version);
    const info = JSON.parse(readResource("2d6mcp://info").text) as { version: string };
    expect(info.version).toBe(rootPkg.version);
  });

  it("maps conventional-commit bumps, treating 0.x breaking as minor", () => {
    expect(parseSemver("0.7.0")).toEqual({ major: 0, minor: 7, patch: 0 });
    expect(bumpSemver("0.7.0", "patch")).toBe("0.7.1");
    expect(bumpSemver("0.7.0", "minor")).toBe("0.8.0");
    expect(() => bumpSemver("0.7.0", "major")).toThrow(/unstable API/);
    expect(bumpSemver("0.7.0", "major", { force: true })).toBe("1.0.0");
    expect(bumpSemver("1.2.3", "major")).toBe("2.0.0");
  });

  it("writes every lockstep file together and refuses drift", () => {
    const dir = makeFixtureRepo();
    try {
      const files = collectVersionFiles(dir).map((file) => file.label).sort();
      expect(files).toEqual([
        "package-lock.json",
        "package.json",
        "packages/server/package.json",
        "packages/shared/package.json",
        "server.json",
      ]);

      const bumped = applyVersion(dir, "0.8.0");
      expect(bumped).toEqual({
        from: "0.7.0",
        to: "0.8.0",
        files: collectVersionFiles(dir).map((file) => file.label),
      });
      expect(assertLockstep(dir).version).toBe("0.8.0");

      const serverJson = JSON.parse(readFileSync(join(dir, "server.json"), "utf8")) as {
        version: string;
        packages: Array<{ version: string }>;
      };
      expect(serverJson.version).toBe("0.8.0");
      expect(serverJson.packages[0].version).toBe("0.8.0");

      writeJson(join(dir, "packages/shared/package.json"), { name: "@2d6mcp/shared", version: "0.8.1" });
      expect(() => assertLockstep(dir)).toThrow(/drifted/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("dry-runs bump without writing, and the repo check CLI succeeds", () => {
    const dir = makeFixtureRepo();
    try {
      const lines: string[] = [];
      const code = runCli(["bump", "minor", "--dry-run"], {
        root: dir,
        stdout: (line) => lines.push(line),
      });
      expect(code).toBe(0);
      expect(lines.join("\n")).toContain("0.7.0 → 0.8.0");
      expect(assertLockstep(dir).version).toBe("0.7.0");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const output = execFileSync(process.execPath, [SCRIPT, "check"], { encoding: "utf8" });
    expect(output).toMatch(/Version lockstep: ok \(0\.\d+\.\d+, \d+ package\.json files\)/);
  });
});
