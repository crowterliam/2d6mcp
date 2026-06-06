// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// OGL SCOPE NOTICE:
// This handler queries Open Game Content from the Orcus retro-clone database.
// Orcus is a retro-clone of 4th Edition by Chris Sakkas (Sanglorian),
// released under OGL v1.0a. See data/orcus/ATTRIBUTION for full details.

import { ensureOrcusSchema } from "@2d6mcp/orcus/database";
import {
  searchOrcusRules,
  searchOrcusClasses,
  searchOrcusMonsters,
  searchOrcusFeats,
  listOrcusClasses,
  listOrcusMonsters,
  listOrcusFeats,
} from "@2d6mcp/orcus";
import { ensureOrcusDb } from "../helpers.js";

export async function handleQueryOrcusRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm = typeof args?.search_term === "string" ? args.search_term : "";
  const category = typeof args?.category === "string" ? args.category : "";

  const { dbPath } = ensureOrcusDb();
  const db = ensureOrcusSchema(dbPath);

  const response: Record<string, unknown> = {};

  switch (category.toLowerCase()) {
    case "classes":
      response.classes = searchOrcusClasses(db, searchTerm);
      break;
    case "monsters":
      response.monsters = searchOrcusMonsters(db, searchTerm);
      break;
    case "feats":
      response.feats = searchOrcusFeats(db, searchTerm);
      break;
    case "list_classes":
      response.classes_list = listOrcusClasses(db);
      break;
    case "list_monsters":
      response.monsters_list = listOrcusMonsters(db);
      break;
    case "list_feats":
      response.feats_list = listOrcusFeats(db);
      break;
    case "rules":
      response.rules = searchOrcusRules(db, searchTerm);
      break;
    default:
      response.rules = searchOrcusRules(db, searchTerm);
      response.classes = searchOrcusClasses(db, searchTerm);
      response.monsters = searchOrcusMonsters(db, searchTerm);
      response.feats = searchOrcusFeats(db, searchTerm);
      break;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}
