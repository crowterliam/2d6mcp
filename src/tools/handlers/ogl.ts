// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { getDatabase } from "../../ogl/database.js";
import {
  searchOglRules,
  searchOglTables,
  searchOglSkills,
  searchOglCareers,
  searchOglEquipment,
  searchCombat,
  searchShipOps,
  searchWorldBuilding,
  listOglCategories,
  listOglTables,
} from "../../ogl/queries.js";
import { ensureOglDb } from "../helpers.js";

export async function handleQueryOglRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm =
    typeof args?.search_term === "string" ? args.search_term : "";
  const category =
    typeof args?.category === "string" ? args.category : "";

  const { dbPath } = ensureOglDb();
  const db = getDatabase(dbPath);

  const response: Record<string, unknown> = {};

  switch (category.toLowerCase()) {
    case "skills":
      response.skills = searchOglSkills(db, searchTerm);
      break;
    case "careers":
      response.careers = searchOglCareers(db, searchTerm);
      break;
    case "equipment":
      response.equipment = searchOglEquipment(db, searchTerm);
      break;
    case "tables": {
      const table = searchOglTables(db, searchTerm);
      response.tables = table
        ? [{ name: table.name, entries: table.entries }]
        : [];
      break;
    }
    case "categories":
      response.categories = listOglCategories(db);
      break;
    case "combat":
      response.combat = searchCombat(db, searchTerm);
      break;
    case "starships":
    case "ship_ops":
      response.starships = searchShipOps(db, searchTerm);
      break;
    case "worlds":
    case "world_building":
      response.worlds = searchWorldBuilding(db, searchTerm);
      break;
    case "list_tables":
      response.tables_list = listOglTables(db);
      break;
    default:
      response.rules = searchOglRules(db, searchTerm);
      response.skills = searchOglSkills(db, searchTerm);
      response.careers = searchOglCareers(db, searchTerm);
      response.equipment = searchOglEquipment(db, searchTerm);
      response.combat = searchCombat(db, searchTerm);
      response.starships = searchShipOps(db, searchTerm);
      response.worlds = searchWorldBuilding(db, searchTerm);
      break;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}
