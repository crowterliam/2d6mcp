import { describe, it, expect } from "vitest";
import { entryMatchesQuery, matchCatalogEntries, type CatalogEntry } from "../../packages/server/src/byod/catalog.js";

const traveller: CatalogEntry = { name: "Traveller", relativePath: "Traveller", kind: "dir" };
const mongooseTraveller: CatalogEntry = {
  name: "Mongoose Traveller",
  relativePath: "Mongoose Traveller",
  kind: "dir",
};
const callOfCthulhu: CatalogEntry = {
  name: "Call of Cthulhu",
  relativePath: "Call of Cthulhu",
  kind: "dir",
};
const trailOfCthulhu: CatalogEntry = {
  name: "Trail of Cthulhu",
  relativePath: "Trail of Cthulhu",
  kind: "dir",
};
const thirteenthAge: CatalogEntry = { name: "13th Age", relativePath: "13th Age", kind: "dir" };

const catalog = [traveller, mongooseTraveller, callOfCthulhu, trailOfCthulhu, thirteenthAge];

describe("entryMatchesQuery", () => {
  it("matches a short system name to the folder", () => {
    expect(entryMatchesQuery(traveller, "traveller")).toBe(true);
  });

  it("matches a long question that names the system", () => {
    expect(entryMatchesQuery(traveller, "how does jump drive work in traveller")).toBe(true);
  });

  it("does not match unrelated combat questions to Traveller", () => {
    expect(entryMatchesQuery(traveller, "how does combat work")).toBe(false);
  });

  it("does not treat substrings like advantage as a match for 13th Age", () => {
    expect(entryMatchesQuery(thirteenthAge, "advantage on attacks")).toBe(false);
  });

  it("distinguishes Call of Cthulhu from Trail of Cthulhu", () => {
    expect(entryMatchesQuery(callOfCthulhu, "call of cthulhu sanity")).toBe(true);
    expect(entryMatchesQuery(trailOfCthulhu, "call of cthulhu sanity")).toBe(false);
  });

  it("matches a shared token to every folder that contains it", () => {
    expect(entryMatchesQuery(callOfCthulhu, "cthulhu")).toBe(true);
    expect(entryMatchesQuery(trailOfCthulhu, "cthulhu")).toBe(true);
    expect(entryMatchesQuery(traveller, "cthulhu")).toBe(false);
  });
});

describe("matchCatalogEntries", () => {
  it("selects Traveller collections from a Traveller request", () => {
    const matched = matchCatalogEntries(catalog, "jump drive traveller");
    expect(matched.map((e) => e.name)).toEqual(["Traveller", "Mongoose Traveller"]);
  });

  it("does not pull the whole catalog for a generic question", () => {
    expect(matchCatalogEntries(catalog, "how does combat work")).toEqual([]);
  });

  it("does not pull Trail of Cthulhu for a Call of Cthulhu request", () => {
    expect(matchCatalogEntries(catalog, "call of cthulhu sanity").map((e) => e.name)).toEqual([
      "Call of Cthulhu",
    ]);
  });
});
