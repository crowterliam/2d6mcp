/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getToolDefinitions } from "../../packages/server/src/tools/definitions.js";
import { getPromptDefinitions } from "../../packages/server/src/prompts.js";
import { getResourceDefinitions } from "../../packages/server/src/resources.js";

const ROOT = process.cwd();

describe("LobeHub MCP score requirements", () => {
  it("has README, LICENSE, and non-manual install metadata", () => {
    expect(existsSync(resolve(ROOT, "README.md"))).toBe(true);
    expect(existsSync(resolve(ROOT, "LICENSE"))).toBe(true);
    const license = readFileSync(resolve(ROOT, "LICENSE"), "utf8");
    expect(license).toContain("GNU AFFERO GENERAL PUBLIC LICENSE");

    expect(existsSync(resolve(ROOT, "smithery.yaml"))).toBe(true);
    expect(existsSync(resolve(ROOT, "Dockerfile"))).toBe(true);
    expect(existsSync(resolve(ROOT, "server.json"))).toBe(true);

    const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/npx/);
    expect(readme).toMatch(/crowterliam-2d6mcp/);
    expect(readme).toMatch(/docker/i);

    const serverJson = JSON.parse(readFileSync(resolve(ROOT, "server.json"), "utf8")) as {
      name: string;
      packages: Array<{ registryType: string; identifier: string; transport: { type: string } }>;
    };
    expect(serverJson.name).toBe("io.github.crowterliam/2d6mcp");
    expect(serverJson.packages[0].registryType).toBe("npm");
    expect(serverJson.packages[0].identifier).toBe("crowterliam-2d6mcp");
    expect(serverJson.packages[0].transport.type).toBe("stdio");
  });

  it("exposes tools, prompts, and resources for marketplace counts", () => {
    expect(getToolDefinitions().length).toBeGreaterThan(0);
    expect(getPromptDefinitions().length).toBeGreaterThan(0);
    expect(getResourceDefinitions().length).toBeGreaterThan(0);
    expect(getToolDefinitions().every((tool) => tool.annotations)).toBe(true);
  });
});
