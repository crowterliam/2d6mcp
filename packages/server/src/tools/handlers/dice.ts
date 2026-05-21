// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { roll2d6, rollCustom } from "@2d6mcp/shared/dice";
import { rollOnTable, normalizeDiceType } from "@2d6mcp/shared/tables";
import { getDatabase } from "@2d6mcp/ogl/database";
import { searchOglTables } from "@2d6mcp/ogl";
import { ensureOglDb } from "../helpers.js";

export async function handleRoll2d6(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const modifier = typeof args?.modifier === "number" ? args.modifier : 0;
  const target =
    typeof args?.target_number === "number" ? args.target_number : null;
  const result = roll2d6(modifier, target);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

export async function handleRollCustom(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const notation =
    typeof args?.notation === "string" ? args.notation : "2d6";
  try {
    const result = rollCustom(notation);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export async function handleRollTable(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const tableName =
    typeof args?.table_name === "string" ? args.table_name : "";
  const diceType =
    typeof args?.dice_type === "string"
      ? normalizeDiceType(args.dice_type)
      : "2d6";

  const { dbPath } = ensureOglDb();
  const db = getDatabase(dbPath);

  const table = searchOglTables(db, tableName);

  if (table && table.entries.length > 0) {
    const result = rollOnTable({
      name: table.name,
      description: table.description || undefined,
      diceType: table.diceType as "1d6" | "2d6" | "d66" | "1d3" | "2d3",
      entries: table.entries,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  const result = rollOnTable({
    name: tableName,
    diceType,
    entries: [],
  });
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ...result,
            warning: `Table "${tableName}" not found in OGL database. Rolled raw ${diceType}: ${result.rollValue}`,
          },
          null,
          2
        ),
      },
    ],
  };
}
