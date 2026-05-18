import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".xml", ".csv", ".html"]);
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, ".pdf"]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface IngestedFile {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  ext: string;
}

export interface IngestedChunk {
  filePath: string;
  fileName: string;
  title: string;
  content: string;
  chunkIndex: number;
}

function walkDirectory(dir: string, baseDir: string): IngestedFile[] {
  const results: IngestedFile[] = [];
  if (!existsSync(dir)) return results;

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (entry.startsWith(".")) continue;

    try {
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...walkDirectory(fullPath, baseDir));
      } else if (stat.isFile()) {
        const ext = extname(entry).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push({
            path: fullPath,
            relativePath: fullPath.replace(baseDir + "/", ""),
            name: entry,
            size: stat.size,
            ext,
          });
        }
      }
    } catch {
      // skip files that can't be read
    }
  }

  return results;
}

export function discoverFiles(byodPath: string): IngestedFile[] {
  const resolved = resolve(byodPath);
  return walkDirectory(resolved, resolved);
}

function readTextFile(filePath: string): string {
  return readFileSync(filePath, "utf-8");
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .trim();
}

function chunkText(text: string, maxChunkSize = 2000, overlap = 200): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + "\n\n" + trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

export function ingestFile(file: IngestedFile): IngestedChunk[] {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return [];
  }

  let text: string;

  if (TEXT_EXTENSIONS.has(file.ext)) {
    text = readTextFile(file.path);
  } else if (file.ext === ".pdf") {
    text = readTextFile(file.path);
  } else {
    return [];
  }

  text = cleanText(text);
  if (!text) return [];

  const chunks = chunkText(text);
  const title =
    file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

  return chunks.map((content, index) => ({
    filePath: file.relativePath,
    fileName: file.name,
    title: index === 0 ? title : `${title} (part ${index + 1})`,
    content,
    chunkIndex: index,
  }));
}

export function ingestDirectory(byodPath: string): {
  files: IngestedFile[];
  chunks: IngestedChunk[];
} {
  const files = discoverFiles(byodPath);
  const chunks: IngestedChunk[] = [];

  for (const file of files) {
    chunks.push(...ingestFile(file));
  }

  return { files, chunks };
}
