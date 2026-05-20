// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { PDFParse } from "pdf-parse";
import { DOMParser } from "@xmldom/xmldom";

const TEXT_EXTENSIONS = new Set([".txt", ".json", ".xml", ".csv"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const HTML_EXTENSIONS = new Set([".html", ".htm"]);
const SUPPORTED_EXTENSIONS = new Set([
  ...TEXT_EXTENSIONS,
  ...MARKDOWN_EXTENSIONS,
  ...HTML_EXTENSIONS,
  ".pdf",
]);
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export interface IngestedFile {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  ext: string;
  hash: string;
}

export interface IngestedChunk {
  filePath: string;
  fileName: string;
  title: string;
  content: string;
  chunkIndex: number;
}

export interface IngestOptions {
  chunkSize: number;
  overlap: number;
  maxChunksPerFile: number;
}

interface HeadingSection {
  level: number;
  heading: string;
  breadcrumb: string;
  lines: string[];
}

function log(message: string): void {
  process.stderr.write(`2d6mcp: ${message}\n`);
}

function capChunks(
  chunks: IngestedChunk[],
  maxChunks: number,
  fileName: string
): IngestedChunk[] {
  if (chunks.length > maxChunks) {
    log(
      `${fileName}: capped at ${maxChunks} chunks (${chunks.length} produced)`
    );
    return chunks.slice(0, maxChunks);
  }
  return chunks;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
          if (stat.size > MAX_FILE_SIZE_BYTES) {
            log(`Skipping ${entry} — exceeds 50 MB limit`);
            continue;
          }

          const fingerprint = String(stat.mtimeMs) + "-" + String(stat.size);

          results.push({
            path: fullPath,
            relativePath: fullPath.replace(baseDir + "/", ""),
            name: entry,
            size: stat.size,
            ext,
            hash: fingerprint,
          });
        }
      }
    } catch {
      log(`Skipping ${entry} — could not stat file`);
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

function splitTextToChunks(
  text: string,
  maxChunkSize: number,
  overlap: number
): string[] {
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

function guessTitleFromFirstLine(text: string): string | null {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length >= 3 && firstLine.length <= 120 && firstLine === firstLine.toUpperCase()) {
    return firstLine;
  }
  return null;
}

function stripHtmlTags(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const removeElements = (tagName: string) => {
      const elements = doc.getElementsByTagName(tagName);
      while (elements.length > 0) {
        elements[0].parentNode?.removeChild(elements[0]);
      }
    };
    removeElements("script");
    removeElements("style");
    const text = doc.textContent || "";
    return text
      .replace(/\s+/g, " ")
      .replace(/&nbsp;/g, " ")
      .trim();
  } catch {
    let text = html
      .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
    return text.trim();
  }
}

function stripFrontmatter(text: string): { body: string; title: string | null } {
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") return { body: text, title: null };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }

  if (end === -1) return { body: text, title: null };

  const fmLines = lines.slice(1, end);
  let title: string | null = null;
  for (const line of fmLines) {
    const m = line.match(/^title:\s*(.+)/i);
    if (m) {
      title = m[1].replace(/^["']|["']$/g, "").trim();
      break;
    }
  }

  return { body: lines.slice(end + 1).join("\n"), title };
}

function extractMarkdownTitle(text: string): string | null {
  const m = text.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : null;
}

function parseMarkdownSections(text: string): HeadingSection[] {
  const lines = text.split("\n");
  const sections: HeadingSection[] = [];
  const breadcrumbStack: string[] = [];
  let current: HeadingSection | null = null;

  function flushSection() {
    if (current && current.lines.length > 0) {
      sections.push({ ...current });
    }
    current = null;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flushSection();

      const level = headingMatch[1].length;
      const heading = headingMatch[2].trim();

      while (breadcrumbStack.length >= level) {
        breadcrumbStack.pop();
      }
      breadcrumbStack.push(heading);

      const breadcrumb = breadcrumbStack.join(" > ");

      current = { level, heading, breadcrumb, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      current = { level: 0, heading: "(preamble)", breadcrumb: "", lines: [line] };
    }
  }

  flushSection();

  return sections;
}

function sectionToContent(section: HeadingSection, keepHeading: boolean): string {
  const lines = keepHeading ? section.lines : section.lines.slice(1);
  return lines.join("\n").trim();
}

function ingestMarkdownFile(
  file: IngestedFile,
  options: IngestOptions
): IngestedChunk[] {
  let raw: string;
  try {
    raw = readTextFile(file.path);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Failed to read ${file.name}: ${msg}`);
    return [];
  }

  raw = cleanText(raw);
  if (!raw) return [];

  const { body, title: fmTitle } = stripFrontmatter(raw);
  const mdTitle = extractMarkdownTitle(body) ?? fmTitle ?? null;

  const sections = parseMarkdownSections(body);
  if (sections.length === 0) return [];

  const docTitle =
    mdTitle ??
    (sections.length > 0 && sections[0].level === 1 ? sections[0].heading : null) ??
    file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

  const chunks: IngestedChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const content = sectionToContent(section, section.level > 0);
    if (!content) continue;

    let label: string;
    if (section.breadcrumb) {
      label = `${docTitle} > ${section.breadcrumb}`;
    } else if (mdTitle) {
      label = docTitle;
    } else {
      label = section.heading !== "(preamble)" ? `${docTitle} > ${section.heading}` : docTitle;
    }

    if (content.length <= options.chunkSize) {
      chunks.push({
        filePath: file.relativePath,
        fileName: file.name,
        title: label,
        content,
        chunkIndex: chunkIndex++,
      });
    } else {
      const subChunks = splitTextToChunks(content, options.chunkSize, options.overlap);
      for (let i = 0; i < subChunks.length; i++) {
        const subLabel =
          subChunks.length > 1 ? `${label} (part ${i + 1})` : label;
        chunks.push({
          filePath: file.relativePath,
          fileName: file.name,
          title: subLabel,
          content: subChunks[i],
          chunkIndex: chunkIndex++,
        });
      }
    }
  }

  return capChunks(chunks, options.maxChunksPerFile, file.name);
}

async function ingestPdfFile(
  file: IngestedFile,
  options: IngestOptions
): Promise<IngestedChunk[]> {
  const pdf = new PDFParse({ data: readFileSync(file.path) });

  try {
    const result = await pdf.getText({ pageJoiner: "" });
    const pages = result.pages || [];

    if (pages.length === 0) {
      log(`PDF ${file.name}: no extractable text pages`);
      return [];
    }

    const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
    const chunks: IngestedChunk[] = [];
    let chunkIndex = 0;

    for (const page of pages) {
      const pageText = cleanText(page.text);
      if (!pageText) continue;

      if (pageText.length <= options.chunkSize) {
        const label =
          pages.length > 1
            ? `${title} (page ${page.num})`
            : title;
        chunks.push({
          filePath: file.relativePath,
          fileName: file.name,
          title: label,
          content: pageText,
          chunkIndex: chunkIndex++,
        });
      } else {
        const subChunks = splitTextToChunks(pageText, options.chunkSize, options.overlap);
        for (let i = 0; i < subChunks.length; i++) {
          const label =
            subChunks.length > 1
              ? `${title} (page ${page.num}, part ${i + 1})`
              : `${title} (page ${page.num})`;
          chunks.push({
            filePath: file.relativePath,
            fileName: file.name,
            title: label,
            content: subChunks[i],
            chunkIndex: chunkIndex++,
          });
        }
      }
    }

    return capChunks(chunks, options.maxChunksPerFile, file.name);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Failed to parse PDF ${file.name}: ${msg}`);
    return [];
  } finally {
    await pdf.destroy();
  }
}

function ingestTextFile(
  file: IngestedFile,
  options: IngestOptions
): IngestedChunk[] {
  let text: string;

  try {
    text = readTextFile(file.path);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Failed to read ${file.name}: ${msg}`);
    return [];
  }

  text = cleanText(text);
  if (!text) return [];

  const firstLineTitle = guessTitleFromFirstLine(text);
  const displayTitle =
    firstLineTitle ??
    file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");

  const body = firstLineTitle
    ? text.split("\n").slice(1).join("\n").trim()
    : text;

  if (!body) return [];

  const chunkTexts = splitTextToChunks(body, options.chunkSize, options.overlap);

  const chunks = chunkTexts.map((content, index) => ({
    filePath: file.relativePath,
    fileName: file.name,
    title:
      chunkTexts.length > 1
        ? `${displayTitle} (part ${index + 1})`
        : displayTitle,
    content,
    chunkIndex: index,
  }));

  return capChunks(chunks, options.maxChunksPerFile, file.name);
}

function ingestHtmlFile(
  file: IngestedFile,
  options: IngestOptions
): IngestedChunk[] {
  let html: string;

  try {
    html = readTextFile(file.path);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log(`Failed to read ${file.name}: ${msg}`);
    return [];
  }

  const text = stripHtmlTags(html);
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
  const chunkTexts = splitTextToChunks(cleaned, options.chunkSize, options.overlap);

  const chunks = chunkTexts.map((content, index) => ({
    filePath: file.relativePath,
    fileName: file.name,
    title:
      chunkTexts.length > 1
        ? `${title} (part ${index + 1})`
        : title,
    content,
    chunkIndex: index,
  }));

  return capChunks(chunks, options.maxChunksPerFile, file.name);
}

export async function ingestFile(
  file: IngestedFile,
  options: IngestOptions
): Promise<IngestedChunk[]> {
  if (file.ext === ".pdf") {
    return ingestPdfFile(file, options);
  }

  if (MARKDOWN_EXTENSIONS.has(file.ext)) {
    return ingestMarkdownFile(file, options);
  }

  if (HTML_EXTENSIONS.has(file.ext)) {
    return ingestHtmlFile(file, options);
  }

  if (TEXT_EXTENSIONS.has(file.ext)) {
    return ingestTextFile(file, options);
  }

  return [];
}

export async function ingestDirectory(
  byodPath: string,
  options: IngestOptions
): Promise<{
  files: IngestedFile[];
  chunks: IngestedChunk[];
}> {
  const files = discoverFiles(byodPath);
  const chunks: IngestedChunk[] = [];
  let processed = 0;

  log(`Found ${files.length} files in BYOD directory. Ingesting...`);

  for (const file of files) {
    const fileChunks = await ingestFile(file, options);
    chunks.push(...fileChunks);
    processed++;
  }

  log(`Ingested ${processed} files (${chunks.length} chunks).`);
  return { files, chunks };
}
