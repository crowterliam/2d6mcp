// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { ensureDwSchema } from "@2d6mcp/dw/database";
import {
  searchDwRules,
  searchDwMoves,
  searchDwClasses,
  searchDwSpells,
  searchDwEquipment,
  searchDwMonsters,
  searchDwGmTools,
  listDwMoveCategories,
  listDwMonsterSettings,
} from "@2d6mcp/dw";
import { ensureDwDb } from "../helpers.js";

export async function handleQueryDwRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm =
    typeof args?.search_term === "string" ? args.search_term : "";
  const category =
    typeof args?.category === "string" ? args.category : "";

  const { dbPath } = ensureDwDb();
  const db = ensureDwSchema(dbPath);

  const response: Record<string, unknown> = {};

  switch (category.toLowerCase()) {
    case "moves":
      response.moves = searchDwMoves(db, searchTerm);
      response.move_categories = listDwMoveCategories(db);
      break;
    case "classes":
      response.classes = searchDwClasses(db, searchTerm);
      break;
    case "spells":
      response.spells = searchDwSpells(db, searchTerm);
      break;
    case "equipment":
      response.equipment = searchDwEquipment(db, searchTerm);
      break;
    case "monsters":
      response.monsters = searchDwMonsters(db, searchTerm);
      response.monster_settings = listDwMonsterSettings(db);
      break;
    case "gm_tools":
    case "gm":
      response.gm_tools = searchDwGmTools(db, searchTerm);
      break;
    case "rules":
      response.rules = searchDwRules(db, searchTerm);
      break;
    default:
      response.moves = searchDwMoves(db, searchTerm);
      response.classes = searchDwClasses(db, searchTerm);
      response.spells = searchDwSpells(db, searchTerm);
      response.equipment = searchDwEquipment(db, searchTerm);
      response.monsters = searchDwMonsters(db, searchTerm);
      response.gm_tools = searchDwGmTools(db, searchTerm);
      break;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}
