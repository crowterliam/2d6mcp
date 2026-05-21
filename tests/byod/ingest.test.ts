import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { discoverFiles, ingestFile, type IngestedFile, type IngestOptions } from "../../packages/server/src/byod/ingest.js";

const TMP = join(tmpdir(), `2d6mcp-test-ingest-${Date.now()}`);
const DEFAULT_OPTIONS: IngestOptions = {
  chunkSize: 8000,
  overlap: 400,
  maxChunksPerFile: 500,
};

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe("discoverFiles", () => {
  it("returns empty array for nonexistent directory", () => {
    const files = discoverFiles("/nonexistent/path/xyz");
    expect(files).toEqual([]);
  });

  it("discovers supported files", () => {
    writeFileSync(join(TMP, "test.txt"), "hello world");
    writeFileSync(join(TMP, "doc.md"), "# Title\nContent");
    writeFileSync(join(TMP, "data.json"), '{"key": "value"}');

    const files = discoverFiles(TMP);
    const names = files.map((f) => f.name);
    expect(names).toContain("test.txt");
    expect(names).toContain("doc.md");
    expect(names).toContain("data.json");
  });

  it("skips dotfiles", () => {
    writeFileSync(join(TMP, ".hidden"), "secret");
    writeFileSync(join(TMP, "visible.txt"), "hello");
    const files = discoverFiles(TMP);
    const names = files.map((f) => f.name);
    expect(names).not.toContain(".hidden");
    expect(names).toContain("visible.txt");
  });

  it("skips unsupported extensions", () => {
    writeFileSync(join(TMP, "image.png"), "not-a-png");
    writeFileSync(join(TMP, "text.txt"), "hello");
    const files = discoverFiles(TMP);
    const names = files.map((f) => f.name);
    expect(names).not.toContain("image.png");
    expect(names).toContain("text.txt");
  });

  it("computes hash from stat info", () => {
    writeFileSync(join(TMP, "hashed.txt"), "content");
    const files = discoverFiles(TMP);
    const f = files.find((f) => f.name === "hashed.txt");
    expect(f).toBeDefined();
    expect(f!.hash).toBeTruthy();
    expect(f!.hash).toContain("-");
  });

  it("computes contentHash from file contents", () => {
    writeFileSync(join(TMP, "sha.txt"), "sha test content");
    const files = discoverFiles(TMP);
    const f = files.find((f) => f.name === "sha.txt");
    expect(f).toBeDefined();
    expect(f!.contentHash).toBeTruthy();
    expect(f!.contentHash).toHaveLength(64);
  });

  it("walks subdirectories", () => {
    const sub = join(TMP, "subdir");
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, "nested.txt"), "nested content");
    const files = discoverFiles(TMP);
    const f = files.find((f) => f.name === "nested.txt");
    expect(f).toBeDefined();
    expect(f!.relativePath).toContain("subdir");
  });
});

describe("ingestFile - text files", () => {
  it("ingests a simple text file", async () => {
    const filePath = join(TMP, "simple.txt");
    writeFileSync(filePath, "Hello world this is a test.");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "simple.txt",
      name: "simple.txt",
      size: 28,
      ext: ".txt",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain("Hello world");
  });

  it("uses uppercase first line as title", async () => {
    const filePath = join(TMP, "titled.txt");
    writeFileSync(filePath, "MY DOCUMENT\nThe actual content here.");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "titled.txt",
      name: "titled.txt",
      size: 40,
      ext: ".txt",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks[0].title).toBe("MY DOCUMENT");
    expect(chunks[0].content).not.toContain("MY DOCUMENT");
  });

  it("splits into multiple chunks for large content", async () => {
    const longText = Array(100).fill("Paragraph with some content to fill space.").join("\n\n");
    const filePath = join(TMP, "long.txt");
    writeFileSync(filePath, longText);
    const file: IngestedFile = {
      path: filePath,
      relativePath: "long.txt",
      name: "long.txt",
      size: longText.length,
      ext: ".txt",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, { ...DEFAULT_OPTIONS, chunkSize: 200 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe("ingestFile - markdown files", () => {
  it("ingests markdown with headings", async () => {
    const filePath = join(TMP, "doc.md");
    writeFileSync(filePath, "# My Doc\n\nSome intro.\n\n## Section One\n\nContent of section one.");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "doc.md",
      name: "doc.md",
      size: 80,
      ext: ".md",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const titles = chunks.map((c) => c.title);
    const hasMyDoc = titles.some((t) => t.includes("My Doc"));
    expect(hasMyDoc).toBe(true);
  });

  it("handles markdown with frontmatter", async () => {
    const filePath = join(TMP, "frontmatter.md");
    writeFileSync(filePath, "---\ntitle: Custom Title\n---\n\n# Heading\n\nBody text.");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "frontmatter.md",
      name: "frontmatter.md",
      size: 70,
      ext: ".md",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("respects maxChunksPerFile", async () => {
    const filePath = join(TMP, "capped.md");
    const sections = Array(20).fill(null).map((_, i) => `## Section ${i}\n\nContent for section ${i}.`).join("\n\n");
    writeFileSync(filePath, sections);
    const file: IngestedFile = {
      path: filePath,
      relativePath: "capped.md",
      name: "capped.md",
      size: sections.length,
      ext: ".md",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, { ...DEFAULT_OPTIONS, maxChunksPerFile: 3 });
    expect(chunks.length).toBeLessThanOrEqual(3);
  });

  it("returns empty for empty markdown", async () => {
    const filePath = join(TMP, "empty.md");
    writeFileSync(filePath, "");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "empty.md",
      name: "empty.md",
      size: 0,
      ext: ".md",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks).toEqual([]);
  });
});

describe("ingestFile - HTML files", () => {
  it("extracts text from HTML body", async () => {
    const filePath = join(TMP, "page.html");
    writeFileSync(filePath, "<html><body><h1>Hello</h1><p>World of RPG content</p></body></html>");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "page.html",
      name: "page.html",
      size: 100,
      ext: ".html",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).not.toContain("<h1>");
    expect(chunks[0].content).toContain("Hello");
  });

  it("strips script and style content", async () => {
    const filePath = join(TMP, "styled.html");
    writeFileSync(filePath, "<html><head><style>body{color:red}</style></head><body><script>alert('x')</script><p>Game rules content here</p></body></html>");
    const file: IngestedFile = {
      path: filePath,
      relativePath: "styled.html",
      name: "styled.html",
      size: 170,
      ext: ".html",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    if (chunks.length > 0) {
      expect(chunks[0].content).not.toContain("alert");
      expect(chunks[0].content).not.toContain("color:red");
      expect(chunks[0].content).toContain("Game rules");
    }
  });
});

describe("ingestFile - unsupported files", () => {
  it("returns empty for unsupported extension", async () => {
    const file: IngestedFile = {
      path: "/fake/image.png",
      relativePath: "image.png",
      name: "image.png",
      size: 100,
      ext: ".png",
      hash: "test",
      contentHash: null,
    };
    const chunks = await ingestFile(file, DEFAULT_OPTIONS);
    expect(chunks).toEqual([]);
  });
});
