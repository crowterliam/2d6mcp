// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { roll2d6, rollCustom, rollD20, rollPercentile, rollDamage, parseDiceNotation } from "@2d6mcp/shared/dice";
import { rollOnTable, normalizeDiceType } from "@2d6mcp/shared/tables";
import { getDatabase } from "@2d6mcp/ogl/database";
import { searchOglTables } from "@2d6mcp/ogl";
import { ensureOglDb } from "../helpers.js";
import { handleRollByodTable, handleListByodTables } from "./byod-table.js";

export type RollMechanic = "2d6" | "d20" | "percentile" | "damage" | "raw";

const DAMAGE_TYPE = /\b(fire|cold|lightning|thunder|acid|poison|necrotic|radiant|psychic|force|piercing|slashing|bludgeoning|heat|laser)\b/i;

export function inferMechanic(notation: string | undefined): RollMechanic {
  if (!notation || !notation.trim()) return "2d6";
  const compact = notation.replace(/\s/g, "").toLowerCase();
  if (DAMAGE_TYPE.test(notation)) return "damage";
  if (/^(1)?d100([+-]\d+)?$/.test(compact) || /^d%$/.test(compact) || compact.includes("percentile")) {
    return "percentile";
  }
  if (/^(1)?d20([+-]\d+)?$/.test(compact)) return "d20";
  if (/^2d6([+-]\d+)?$/.test(compact)) return "2d6";
  return "raw";
}

function jsonResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

export async function handleRoll(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const notation = typeof args?.notation === "string" ? args.notation : undefined;
  const mechanicArg = typeof args?.mechanic === "string" ? args.mechanic : undefined;
  const mechanic: RollMechanic =
    mechanicArg === "2d6" || mechanicArg === "d20" || mechanicArg === "percentile" || mechanicArg === "damage" || mechanicArg === "raw"
      ? mechanicArg
      : inferMechanic(notation);

  const modifier = typeof args?.modifier === "number" ? args.modifier : undefined;
  const target = typeof args?.target === "number"
    ? args.target
    : typeof args?.target_number === "number"
      ? args.target_number
      : null;
  const advantage = args?.advantage === true;
  const disadvantage = args?.disadvantage === true;

  try {
    if (mechanic === "2d6") {
      let mod = modifier ?? 0;
      if (modifier === undefined && notation) {
        try {
          mod = parseDiceNotation(notation).modifier;
        } catch {
          mod = 0;
        }
      }
      return jsonResult(roll2d6(mod, target));
    }

    if (mechanic === "d20") {
      let mod = modifier ?? 0;
      if (modifier === undefined && notation) {
        try {
          mod = parseDiceNotation(notation).modifier;
        } catch {
          mod = 0;
        }
      }
      return jsonResult(rollD20(mod, target, advantage, disadvantage));
    }

    if (mechanic === "percentile") {
      return jsonResult(rollPercentile(target));
    }

    if (mechanic === "damage") {
      const dmg = notation || "2d6";
      return jsonResult(rollDamage(dmg));
    }

    const raw = notation || "2d6";
    return jsonResult(rollCustom(raw));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
}

export async function handleRollTable(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const source = typeof args?.source === "string" && args.source === "byod" ? "byod" : "ogl";
  const tableName = typeof args?.table_name === "string" ? args.table_name : "";
  const diceType =
    typeof args?.dice_type === "string"
      ? normalizeDiceType(args.dice_type)
      : "2d6";

  if (source === "byod") {
    if (!tableName) {
      return handleListByodTables(args);
    }
    return handleRollByodTable(args);
  }

  const { dbPath } = ensureOglDb();
  const db = getDatabase(dbPath);
  const table = tableName ? searchOglTables(db, tableName) : null;

  if (table && table.entries.length > 0) {
    const result = rollOnTable({
      name: table.name,
      description: table.description || undefined,
      diceType: table.diceType as "1d6" | "2d6" | "d66" | "1d3" | "2d3",
      entries: table.entries,
    });
    return jsonResult(result);
  }

  const result = rollOnTable({
    name: tableName,
    diceType,
    entries: [],
  });
  return jsonResult({
    ...result,
    source,
    warning: tableName
      ? `Table "${tableName}" not found in the OGL database. Rolled raw ${diceType}: ${result.rollValue}`
      : `No table_name provided. Rolled raw ${diceType}: ${result.rollValue}`,
  });
}
