import { describe, it, expect } from "vitest";
import { join, resolve } from "node:path";
import { isPathInside, pathHasPrefix, pathMatchesAnyPrefix, toRelativePath, resolveInsideByod } from "../../packages/server/src/byod/paths.js";

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

describe("resolveInsideByod", () => {
  it("resolves a nested path under BYOD_PATH", () => {
    const root = resolve("/tmp/byod-root");
    expect(resolveInsideByod(root, join("parent", "line"))).toBe(join(root, "parent", "line"));
  });

  it("returns null when the path would escape BYOD_PATH", () => {
    const root = resolve("/tmp/byod-root");
    expect(resolveInsideByod(root, join("..", "outside"))).toBeNull();
  });
});

describe("pathHasPrefix", () => {
  it("matches the prefix itself and nested paths across separators", () => {
    expect(pathHasPrefix("collection-a/core.pdf", "collection-a")).toBe(true);
    expect(pathHasPrefix("collection-a\\core.pdf", "collection-a")).toBe(true);
    expect(pathHasPrefix("collection-a", "collection-a")).toBe(true);
    expect(pathHasPrefix("collection-b/notes.txt", "collection-a")).toBe(false);
    expect(pathHasPrefix("collection-a-website-dump/core.pdf", "collection-a")).toBe(false);
  });

  it("treats an empty prefix as the whole library", () => {
    expect(pathHasPrefix("anything/file.txt", "")).toBe(true);
  });
});

describe("pathMatchesAnyPrefix", () => {
  it("matches if any prefix hits", () => {
    expect(pathMatchesAnyPrefix("parent/line/book.pdf", ["collection-a", "parent/line"])).toBe(true);
    expect(pathMatchesAnyPrefix("other/book.pdf", ["collection-a", "parent/line"])).toBe(false);
  });
});
