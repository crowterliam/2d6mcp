import { describe, it, expect } from "vitest";
import { dispatchToolCall } from "../../packages/server/src/tools/index.js";
import { aliasOglCategory } from "../../packages/server/src/tools/handlers/rules.js";

const SYSTEMS = ["ogl", "dw", "brp", "5ecompatible", "orcus", "osr"] as const;

function parsePayload(result: { content: Array<{ text: string }>; isError?: boolean }): Record<string, unknown> {
  expect(result.isError).toBeUndefined();
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

function assertTradeFilterFreight(payload: Record<string, unknown>) {
  // Trade filter (not core FTS fallthrough) attaches related_filters and the Open SRD note.
  expect(payload.related_filters).toEqual(["skills", "worlds", "starships", "list_tables"]);
  expect(typeof payload.note).toBe("string");
  expect(payload.note as string).toMatch(/Open SRD/i);
  expect(payload.note as string).toMatch(/Cr1,000/);

  expect(payload).toHaveProperty("rules");
  const rules = payload.rules as Array<{ section: string; title: string; snippet: string }>;
  expect(rules.length).toBeGreaterThan(0);
  expect(rules[0].section).toBe("Trade & Commerce");
  expect(/freight/i.test(`${rules[0].title} ${rules[0].snippet}`)).toBe(true);
  expect(rules[0].section.toLowerCase()).not.toBe("game themes");
  expect(rules[0].title.toLowerCase()).not.toBe("overview");
  expect(
    rules.some(
      (r) => /trade/i.test(r.section) && /freight/i.test(`${r.title} ${r.snippet}`)
    )
  ).toBe(true);
  expect(
    rules.some((r) => /game themes/i.test(r.section) && /overview/i.test(r.title))
  ).toBe(false);
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

    const osr = parsePayload(await dispatchToolCall("query_rules", { system: "osr", search_term: "morale" }));
    expect(osr).toHaveProperty("rules");
    expect(osr).not.toHaveProperty("procedures");
    expect(osr).not.toHaveProperty("tables");
  });

  it("category=categories lists filters without requiring a search term", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", category: "categories" })
    );
    expect(Array.isArray(payload.categories)).toBe(true);
    expect(payload.categories).toContain("skills");
    expect(payload.categories).toContain("rules");
    expect(payload.categories).toContain("trade");
  });

  it("osr category=categories lists mid-session filters", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "osr", category: "categories" })
    );
    expect(payload.categories).toContain("saves");
    expect(payload.categories).toContain("reaction");
    expect(payload.categories).toContain("morale");
    expect(payload.categories).toContain("hirelings");
  });

  it("category filter returns that family only", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", search_term: "pilot", category: "skills" })
    );
    expect(payload).toHaveProperty("skills");
    expect(payload).not.toHaveProperty("rules");
    expect(payload).not.toHaveProperty("careers");
  });

  it.each(["trade", "commerce", "Trade & Commerce", "TRADE & COMMERCE", "trade and commerce"])(
    "aliasOglCategory(%s) maps to the trade filter key",
    (category) => {
      expect(aliasOglCategory(category)).toBe("trade");
    }
  );

  it.each(["Trade & Commerce", "TRADE & COMMERCE", "trade", "commerce"])(
    "query_rules category=%s freight uses the trade filter, not core FTS",
    async (category) => {
      const payload = parsePayload(
        await dispatchToolCall("query_rules", {
          system: "ogl",
          category,
          search_term: "freight",
        })
      );
      assertTradeFilterFreight(payload);
    }
  );

  it("core FTS freight does not attach the trade-filter note", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", search_term: "freight" })
    );
    expect(payload).not.toHaveProperty("related_filters");
    expect(payload).not.toHaveProperty("note");
  });

  it("category=trade finds Broker and trade-route content", async () => {
    const broker = parsePayload(
      await dispatchToolCall("query_rules", {
        system: "ogl",
        category: "trade",
        search_term: "Broker",
      })
    );
    const brokerRules = broker.rules as Array<{ title: string; snippet: string }>;
    expect(brokerRules.some((r) => /broker/i.test(`${r.title} ${r.snippet}`))).toBe(true);

    const routes = parsePayload(
      await dispatchToolCall("query_rules", {
        system: "ogl",
        category: "trade",
        search_term: "trade route",
      })
    );
    const routeRules = routes.rules as Array<{ title: string; snippet: string }>;
    expect(routeRules.some((r) => /trade route/i.test(`${r.title} ${r.snippet}`))).toBe(true);
  });

  it("skills Broker and worlds trade remain valid related lookups", async () => {
    const skills = parsePayload(
      await dispatchToolCall("query_rules", {
        system: "ogl",
        category: "skills",
        search_term: "Broker",
      })
    );
    const skillHits = skills.skills as Array<{ name: string }>;
    expect(skillHits.some((s) => /broker/i.test(s.name))).toBe(true);

    const worlds = parsePayload(
      await dispatchToolCall("query_rules", {
        system: "ogl",
        category: "worlds",
        search_term: "trade",
      })
    );
    const worldHits = worlds.worlds as Array<{ topic: string }>;
    expect(worldHits.some((w) => /trade/i.test(w.topic))).toBe(true);
  });

  it("list_tables does not invent a commercial freight-lot matrix", async () => {
    const payload = parsePayload(
      await dispatchToolCall("query_rules", { system: "ogl", category: "list_tables" })
    );
    const tables = payload.tables_list as Array<{ name: string }>;
    expect(Array.isArray(tables)).toBe(true);
    expect(tables.length).toBeGreaterThan(0);
    expect(tables.some((t) => /freight/i.test(t.name))).toBe(false);
  });
});
