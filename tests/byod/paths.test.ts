import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import { isPathInside, pathHasPrefix, pathMatchesAnyPrefix, toRelativePath } from "../../packages/server/src/byod/paths.js";

describe("toRelativePath", () => {
  it("returns a path relative to the base directory", () => {
    const base = resolve("/tmp/byod-root");
    const nested = join(base, "subdir", "file.txt");
    expect(toRelativePath(base, nested)).toBe(join("subdir", "file.txt"));
  });
});

describe("isPathInside", () => {
  it("accepts the root itself", () => {
    const root = resolve("/tmp/byod-root");
    expect(isPathInside(root, root)).toBe(true);
  });

  it("accepts nested files", () => {
    const root = resolve("/tmp/byod-root");
    expect(isPathInside(root, join(root, "a", "b.txt"))).toBe(true);
  });

  it("rejects paths that escape the root", () => {
    const root = resolve("/tmp/byod-root");
    expect(isPathInside(root, join(root, "..", "outside.txt"))).toBe(false);
  });
});

describe("pathHasPrefix", () => {
  it("matches the prefix itself and nested paths across separators", () => {
    expect(pathHasPrefix("Traveller/core.pdf", "Traveller")).toBe(true);
    expect(pathHasPrefix("Traveller\\core.pdf", "Traveller")).toBe(true);
    expect(pathHasPrefix("Traveller", "Traveller")).toBe(true);
    expect(pathHasPrefix("Call of Cthulhu/sanity.txt", "Traveller")).toBe(false);
    expect(pathHasPrefix("TravellerExtra/core.pdf", "Traveller")).toBe(false);
  });

  it("treats an empty prefix as the whole library", () => {
    expect(pathHasPrefix("anything/file.txt", "")).toBe(true);
  });
});

describe("pathMatchesAnyPrefix", () => {
  it("matches if any prefix hits", () => {
    expect(pathMatchesAnyPrefix("Mongoose Traveller/hg.pdf", ["Traveller", "Mongoose Traveller"])).toBe(true);
    expect(pathMatchesAnyPrefix("D&D/phb.pdf", ["Traveller", "Mongoose Traveller"])).toBe(false);
  });
});
