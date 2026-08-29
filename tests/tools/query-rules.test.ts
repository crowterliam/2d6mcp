import { describe, it, expect } from "vitest";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";

const SYSTEMS = ["ogl", "dw", "brp", "5ecompatible", "orcus"] as const;

function parsePayload(result: { content: Array<{ text: string }>; isError?: boolean }): Record<string, unknown> {
  expect(result.isError).toBeUndefined();
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

describe("query_rules", () => {
  it("requires system", async () => {
    const result = await dispatchToolCall("query_rules", { search_term: "combat" });
    expect(result.isError).toBe(true);
  });

  it.each(SYSTEMS)("searches %s", async (system) => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system, search_term: "combat", category: "rules" })
    );
    expect(payload.system).toBe(system);
    expect(payload).toHaveProperty("rules");
    expect(Array.isArray(payload.rules)).toBe(true);
  });

  it("default category does not fan out every table family", async () => {
    const ogl = parsePayload(await dispatchToolCall("query_rules", { system: "ogl", search_term: "combat" }));
    expect(ogl).toHaveProperty("rules");
    expect(ogl).not.toHaveProperty("skills");
    expect(ogl).not.toHaveProperty("careers");
    expect(ogl).not.toHaveProperty("equipment");
    expect(ogl).not.toHaveProperty("combat");
    expect(ogl).not.toHaveProperty("starships");
    expect(ogl).not.toHaveProperty("worlds");

    const dw = parsePayload(await dispatchToolCall("query_rules", { system: "dw", search_term: "hack" }));
    expect(dw).toHaveProperty("rules");
    expect(dw).not.toHaveProperty("moves");
    expect(dw).not.toHaveProperty("classes");
    expect(dw).not.toHaveProperty("spells");

    const brp = parsePayload(await dispatchToolCall("query_rules", { system: "brp", search_term: "sword" }));
    expect(brp).toHaveProperty("rules");
    expect(brp).not.toHaveProperty("skills");
    expect(brp).not.toHaveProperty("professions");

    const sr5e = parsePayload(await dispatchToolCall("query_rules", { system: "5ecompatible", search_term: "fire" }));
    expect(sr5e).toHaveProperty("rules");
    expect(sr5e).not.toHaveProperty("spells");
    expect(sr5e).not.toHaveProperty("monsters");

    const orcus = parsePayload(await dispatchToolCall("query_rules", { system: "orcus", search_term: "combat" }));
    expect(orcus).toHaveProperty("rules");
    expect(orcus).not.toHaveProperty("classes");
    expect(orcus).not.toHaveProperty("feats");
  });

  it("category=categories lists filters without requiring a search term", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", category: "categories" })
    );
    expect(Array.isArray(payload.categories)).toBe(true);
    expect(payload.categories).toContain("skills");
    expect(payload.categories).toContain("rules");
  });

  it("category filter returns that family only", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", search_term: "pilot", category: "skills" })
    );
    expect(payload).toHaveProperty("skills");
    expect(payload).not.toHaveProperty("rules");
    expect(payload).not.toHaveProperty("careers");
  });
});
