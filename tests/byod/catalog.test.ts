import { describe, it, expect } from "vitest";
import { entryMatchesQuery, matchCatalogEntries, type CatalogEntry } from "../../packages/server/src/byod/catalog.js";

const collectionA: CatalogEntry = { name: "collection-a", relativePath: "collection-a", kind: "dir" };
const websiteDump: CatalogEntry = {
  name: "collection-a-website-dump",
  relativePath: "collection-a-website-dump",
  kind: "dir",
};
const collectionB: CatalogEntry = { name: "collection-b", relativePath: "collection-b", kind: "dir" };
const northLine: CatalogEntry = { name: "north line", relativePath: "north line", kind: "dir" };
const southLine: CatalogEntry = { name: "south line", relativePath: "south line", kind: "dir" };
const ageSystem: CatalogEntry = { name: "age-system", relativePath: "age-system", kind: "dir" };

const catalog = [collectionA, websiteDump, collectionB, northLine, southLine, ageSystem];

describe("entryMatchesQuery", () => {
  it("matches a short collection name to the folder", () => {
    expect(entryMatchesQuery(collectionA, "collection-a")).toBe(true);
  });

  it("matches a long question that names the collection", () => {
    expect(entryMatchesQuery(collectionA, "how does combat work in collection-a")).toBe(true);
  });

  it("does not match unrelated combat questions to collection-a", () => {
    expect(entryMatchesQuery(collectionA, "how does combat work")).toBe(false);
  });

  it("does not treat substrings like advantage as a match for age-system", () => {
    expect(entryMatchesQuery(ageSystem, "advantage on attacks")).toBe(false);
  });

  it("distinguishes two collections that share a later token", () => {
    expect(entryMatchesQuery(northLine, "north line combat")).toBe(true);
    expect(entryMatchesQuery(southLine, "north line combat")).toBe(false);
  });

  it("matches a shared token to every folder that contains it", () => {
    expect(entryMatchesQuery(northLine, "line")).toBe(true);
    expect(entryMatchesQuery(southLine, "line")).toBe(true);
    expect(entryMatchesQuery(collectionA, "line")).toBe(false);
  });
});

describe("matchCatalogEntries", () => {
  it("selects collection-a without a sibling that only shares a name prefix", () => {
    const matched = matchCatalogEntries(catalog, "collection-a");
    expect(matched.map((e) => e.name)).toEqual(["collection-a"]);
  });

  it("does not pull a website-dump sibling for a collection-a question", () => {
    expect(matchCatalogEntries(catalog, "how does combat work in collection-a").map((e) => e.name)).toEqual([
      "collection-a",
    ]);
  });

  it("does not pull the whole catalog for a generic question", () => {
    expect(matchCatalogEntries(catalog, "how does combat work")).toEqual([]);
  });

  it("does not pull collection-b for a collection-a request", () => {
    expect(matchCatalogEntries(catalog, "collection-a combat").map((e) => e.name)).toEqual(["collection-a"]);
  });
});
