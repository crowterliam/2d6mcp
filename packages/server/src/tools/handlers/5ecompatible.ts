// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1")
// by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
// Licensed under CC-BY-4.0. See data/5ecompatible/SRD-NOTICE.txt for full attribution.

import { ensure5ecompatibleSchema } from "@2d6mcp/5ecompatible/database";
import {
  search5ecompatibleRules,
  search5ecompatibleSpells,
  search5ecompatibleMonsters,
  search5ecompatibleClasses,
  search5ecompatibleFeats,
  list5ecompatibleSpells,
  list5ecompatibleMonsters,
  list5ecompatibleClasses,
  list5ecompatibleFeats,
} from "@2d6mcp/5ecompatible";
import { ensure5ecompatibleDb } from "../helpers.js";

export async function handleQuery5ecompatibleRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm = typeof args?.search_term === "string" ? args.search_term : "";
  const category = typeof args?.category === "string" ? args.category : "";

  const { dbPath } = ensure5ecompatibleDb();
  const db = ensure5ecompatibleSchema(dbPath);

  const response: Record<string, unknown> = {};

  switch (category.toLowerCase()) {
    case "spells":
      response.spells = search5ecompatibleSpells(db, searchTerm);
      break;
    case "monsters":
      response.monsters = search5ecompatibleMonsters(db, searchTerm);
      break;
    case "classes":
      response.classes = search5ecompatibleClasses(db, searchTerm);
      break;
    case "feats":
      response.feats = search5ecompatibleFeats(db, searchTerm);
      break;
    case "list_spells":
      response.spells_list = list5ecompatibleSpells(db);
      break;
    case "list_monsters":
      response.monsters_list = list5ecompatibleMonsters(db);
      break;
    case "list_classes":
      response.classes_list = list5ecompatibleClasses(db);
      break;
    case "list_feats":
      response.feats_list = list5ecompatibleFeats(db);
      break;
    case "rules":
      response.rules = search5ecompatibleRules(db, searchTerm);
      break;
    default:
      response.rules = search5ecompatibleRules(db, searchTerm);
      response.spells = search5ecompatibleSpells(db, searchTerm);
      response.monsters = search5ecompatibleMonsters(db, searchTerm);
      response.classes = search5ecompatibleClasses(db, searchTerm);
      response.feats = search5ecompatibleFeats(db, searchTerm);
      break;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}
