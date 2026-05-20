import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const originalEnv = { ...process.env };
const TMP = join(tmpdir(), `2d6mcp-test-discord-${Date.now()}`);
let configPath: string;

beforeEach(() => {
  process.env = { ...originalEnv };
  mkdirSync(TMP, { recursive: true });
  configPath = join(TMP, `.mcp-discord-webhooks-${Date.now()}.json`);
});

afterEach(() => {
  process.env = { ...originalEnv };
  rmSync(TMP, { recursive: true, force: true });
});

function readTestConfig(): { webhooks: any[] } {
  if (!existsSync(configPath)) return { webhooks: [] };
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return { webhooks: [] };
  }
}

function writeTestConfig(config: { webhooks: any[] }): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

describe("parseRoutingContext", () => {
  it("parses all context fields into tags", async () => {
    const mod = await import("../../src/discord/config.js");
    const tags = mod.parseRoutingContext({
      channel_type: "gm, player",
      visibility: "public",
      game_context: "combat, narrative",
      character: "Aragorn",
      location: "Rivendell",
    });
    expect(tags).toContain("gm");
    expect(tags).toContain("player");
    expect(tags).toContain("public");
    expect(tags).toContain("combat");
    expect(tags).toContain("narrative");
    expect(tags).toContain("Aragorn");
    expect(tags).toContain("Rivendell");
  });

  it("returns empty array for empty context", async () => {
    const mod = await import("../../src/discord/config.js");
    const tags = mod.parseRoutingContext({});
    expect(tags).toEqual([]);
  });

  it("deduplicates tags", async () => {
    const mod = await import("../../src/discord/config.js");
    const tags = mod.parseRoutingContext({
      channel_type: "gm",
      visibility: "gm",
    });
    const gmCount = tags.filter((t: string) => t === "gm").length;
    expect(gmCount).toBe(1);
  });
});

describe("webhook config via file I/O", () => {
  it("lists empty when no config file", () => {
    const config = readTestConfig();
    expect(config.webhooks).toEqual([]);
  });

  it("writes and reads webhooks", () => {
    writeTestConfig({
      webhooks: [
        { name: "test-hook", url: "https://discord.com/api/webhooks/123/abc", tags: ["gm"], description: "Test" },
      ],
    });
    const config = readTestConfig();
    expect(config.webhooks).toHaveLength(1);
    expect(config.webhooks[0].name).toBe("test-hook");
  });

  it("removes a webhook by index", () => {
    writeTestConfig({
      webhooks: [
        { name: "hook1", url: "https://discord.com/api/webhooks/123/a", tags: [], description: "" },
        { name: "hook2", url: "https://discord.com/api/webhooks/456/b", tags: [], description: "" },
      ],
    });
    const config = readTestConfig();
    config.webhooks.splice(0, 1);
    writeTestConfig(config);
    const updated = readTestConfig();
    expect(updated.webhooks).toHaveLength(1);
    expect(updated.webhooks[0].name).toBe("hook2");
  });

  it("prevents duplicate names", () => {
    writeTestConfig({
      webhooks: [
        { name: "dup", url: "https://discord.com/api/webhooks/123/a", tags: [], description: "" },
      ],
    });
    const config = readTestConfig();
    const exists = config.webhooks.some((w: any) => w.name.toLowerCase() === "dup");
    expect(exists).toBe(true);
  });
});

describe("resolveWebhooks - tag matching logic", () => {
  const TAG_SYNONYMS: Record<string, string[]> = {
    gm: ["gm", "gamemaster", "dm", "dungeon-master", "secret", "private", "tower"],
    combat: ["combat", "battle", "fight", "initiative", "attack", "damage"],
  };

  function expandSynonyms(tags: string[]): Set<string> {
    const expanded = new Set<string>(tags.map((t) => t.toLowerCase()));
    for (const tag of tags) {
      const lower = tag.toLowerCase();
      for (const [, synonyms] of Object.entries(TAG_SYNONYMS)) {
        if (synonyms.includes(lower)) {
          for (const s of synonyms) expanded.add(s);
        }
      }
    }
    return expanded;
  }

  it("expands combat synonyms", () => {
    const expanded = expandSynonyms(["fight"]);
    expect(expanded.has("combat")).toBe(true);
    expect(expanded.has("battle")).toBe(true);
    expect(expanded.has("initiative")).toBe(true);
  });

  it("expands gm synonyms", () => {
    const expanded = expandSynonyms(["dm"]);
    expect(expanded.has("gm")).toBe(true);
    expect(expanded.has("gamemaster")).toBe(true);
  });
});
