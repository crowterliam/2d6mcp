// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { checkByodConsent, getByodPath } from "../../byod/gate.js";
import { getByodDatabase, searchByodIndex, getChunkContent } from "../../byod/search.js";
import { parseTableFromText, rollForTable, type ParsedTable } from "@2d6mcp/shared/table-parser";

export async function handleRollByodTable(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return { content: [{ type: "text", text: consent.message }], isError: true };
  }

  const tableName = typeof args?.table_name === "string" ? args.table_name.trim() : "";
  if (!tableName) {
    return { content: [{ type: "text", text: "Error: table_name is required" }], isError: true };
  }

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);
  const results = searchByodIndex(db, tableName, 10);

  if (results.length === 0) {
    return {
      content: [{ type: "text", text: `No BYOD content found matching "${tableName}". Try a different search term.` }],
      isError: true,
    };
  }

  const tables: { table: ParsedTable; filePath: string; fileName: string; chunkIndex: number }[] = [];

  for (const result of results) {
    const chunk = getChunkContent(db, result.filePath, 0);
    if (!chunk) continue;

    const startIdx = chunk.chunk.content.toLowerCase().indexOf(tableName.toLowerCase());
    let textToParse = chunk.chunk.content;

    if (startIdx >= 0) {
      const contextStart = Math.max(0, startIdx - 200);
      textToParse = textToParse.substring(contextStart);
    }

    const table = parseTableFromText(textToParse);
    if (table && table.entries.length >= 2) {
      tables.push({
        table,
        filePath: result.filePath,
        fileName: result.fileName,
        chunkIndex: chunk.chunk.chunkIndex,
      });
    }
  }

  for (const result of results) {
    if (tables.length >= 3) break;
    for (let ci = 1; ci < 5; ci++) {
      const chunk = getChunkContent(db, result.filePath, ci);
      if (!chunk) break;

      const table = parseTableFromText(chunk.chunk.content);
      if (table && table.entries.length >= 2) {
        tables.push({
          table,
          filePath: result.filePath,
          fileName: result.fileName,
          chunkIndex: ci,
        });
      }
    }
  }

  if (tables.length === 0) {
    return {
      content: [{
        type: "text",
        text: `Found BYOD content for "${tableName}" but could not parse a random table from it. The content may not contain a structured die-range table.`,
      }],
      isError: true,
    };
  }

  const best = tables[0];
  const { diceResult, entry } = rollForTable(best.table);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        tableName,
        source: {
          filePath: best.filePath,
          fileName: best.fileName,
          chunkIndex: best.chunkIndex,
        },
        diceNotation: best.table.diceNotation,
        rollRange: `${best.table.minRoll}-${best.table.maxRoll}`,
        roll: diceResult,
        result: entry?.result ?? "No matching entry",
        totalEntries: best.table.entries.length,
        allTablesFound: tables.length,
        allEntries: best.table.entries,
      }, null, 2),
    }],
  };
}

export async function handleListByodTables(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const consent = checkByodConsent();
  if (!consent.allowed) {
    return { content: [{ type: "text", text: consent.message }], isError: true };
  }

  const searchTerm = typeof args?.search_term === "string" ? args.search_term.trim() : "";
  const maxResults = typeof args?.max_results === "number" ? Math.min(args.max_results, 30) : 10;

  const byodPath = getByodPath();
  const db = getByodDatabase(byodPath);

  const searchQuery = searchTerm || "table d100 d20 2d6 1d6";
  const results = searchByodIndex(db, searchQuery, Math.min(maxResults * 2, 40));

  const found: {
    tableName: string;
    filePath: string;
    fileName: string;
    chunkIndex: number;
    diceNotation: string;
    entryCount: number;
    sampleEntries: string[];
  }[] = [];

  const seenChunks = new Set<string>();

  for (const result of results) {
    if (found.length >= maxResults) break;

    for (let ci = 0; ci < 3; ci++) {
      const chunkKey = `${result.filePath}:${ci}`;
      if (seenChunks.has(chunkKey)) continue;

      const chunk = getChunkContent(db, result.filePath, ci);
      if (!chunk) break;

      seenChunks.add(chunkKey);

      const table = parseTableFromText(chunk.chunk.content);
      if (table && table.entries.length >= 2) {
        found.push({
          tableName: searchTerm || result.title,
          filePath: result.filePath,
          fileName: result.fileName,
          chunkIndex: ci,
          diceNotation: table.diceNotation,
          entryCount: table.entries.length,
          sampleEntries: table.entries.slice(0, 3).map((e) => `[${e.min}-${e.max}] ${e.result.substring(0, 80)}`),
        });
      }
    }
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        searchQuery: searchTerm || "(broad table search)",
        tablesFound: found.length,
        tables: found,
      }, null, 2),
    }],
  };
}
