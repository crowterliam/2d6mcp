// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { getDatabase } from "@2d6mcp/ogl/database";
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
} from "@2d6mcp/ogl";
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
import { ensureBrpSchema } from "@2d6mcp/brp/database";
import {
  searchBrpRules,
  searchBrpCharacteristics,
  searchBrpDerivedCharacteristics,
  searchBrpSkills,
  searchBrpProfessions,
  searchBrpWeaponsMelee,
  searchBrpWeaponsMissile,
  searchBrpArmor,
  searchBrpShields,
  searchBrpSpotRules,
  searchBrpSampleFoes,
  listBrpCategories,
  listBrpSkills,
  listBrpProfessions,
  listBrpAllWeapons,
} from "@2d6mcp/brp";
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
import { ensureOglDb, ensureDwDb, ensureBrpDb, ensure5ecompatibleDb, ensureOrcusDb } from "../helpers.js";
import { RULES_SYSTEMS, type NamedRulesSystem } from "../../rulings/retrieve.js";

const CATEGORY_FILTERS: Record<NamedRulesSystem, string[]> = {
  ogl: ["rules", "skills", "careers", "equipment", "tables", "combat", "starships", "worlds", "list_tables"],
  dw: ["rules", "moves", "classes", "spells", "equipment", "monsters", "gm_tools"],
  brp: [
    "rules",
    "characteristics",
    "skills",
    "professions",
    "weapons",
    "melee_weapons",
    "missile_weapons",
    "armor",
    "shields",
    "spot_rules",
    "foes",
    "list_skills",
    "list_professions",
    "list_weapons",
  ],
  "5ecompatible": ["rules", "spells", "monsters", "classes", "feats", "list_spells", "list_monsters", "list_classes", "list_feats"],
  orcus: ["rules", "classes", "monsters", "feats", "list_classes", "list_monsters", "list_feats"],
};

function isNamedSystem(value: string): value is NamedRulesSystem {
  return (RULES_SYSTEMS as readonly string[]).includes(value);
}

function jsonResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function queryOgl(searchTerm: string, category: string): Record<string, unknown> {
  const { dbPath } = ensureOglDb();
  const db = getDatabase(dbPath);
  const response: Record<string, unknown> = {};

  switch (category) {
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
      response.tables = table ? [{ name: table.name, entries: table.entries }] : [];
      break;
    }
    case "categories":
      response.categories = CATEGORY_FILTERS.ogl;
      response.rules_categories = listOglCategories(db);
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
      break;
  }
  return response;
}

function queryDw(searchTerm: string, category: string): Record<string, unknown> {
  const db = ensureDwSchema(ensureDwDb().dbPath);
  const response: Record<string, unknown> = {};

  switch (category) {
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
    case "categories":
      response.categories = CATEGORY_FILTERS.dw;
      break;
    default:
      response.rules = searchDwRules(db, searchTerm);
      break;
  }
  return response;
}

function queryBrp(searchTerm: string, category: string): Record<string, unknown> {
  const db = ensureBrpSchema(ensureBrpDb().dbPath);
  const response: Record<string, unknown> = {};

  switch (category) {
    case "characteristics":
      response.characteristics = searchBrpCharacteristics(db, searchTerm);
      response.derived_characteristics = searchBrpDerivedCharacteristics(db, searchTerm);
      break;
    case "skills":
      response.skills = searchBrpSkills(db, searchTerm);
      break;
    case "professions":
      response.professions = searchBrpProfessions(db, searchTerm);
      break;
    case "weapons":
    case "melee_weapons":
      response.melee_weapons = searchBrpWeaponsMelee(db, searchTerm);
      response.missile_weapons = searchBrpWeaponsMissile(db, searchTerm);
      break;
    case "missile_weapons":
      response.missile_weapons = searchBrpWeaponsMissile(db, searchTerm);
      break;
    case "armor":
      response.armor = searchBrpArmor(db, searchTerm);
      response.shields = searchBrpShields(db, searchTerm);
      break;
    case "shields":
      response.shields = searchBrpShields(db, searchTerm);
      break;
    case "spot_rules":
    case "spot":
      response.spot_rules = searchBrpSpotRules(db, searchTerm);
      break;
    case "foes":
    case "monsters":
      response.sample_foes = searchBrpSampleFoes(db, searchTerm);
      break;
    case "categories":
      response.categories = CATEGORY_FILTERS.brp;
      response.rules_categories = listBrpCategories(db);
      break;
    case "list_skills":
      response.skills_list = listBrpSkills(db);
      break;
    case "list_professions":
      response.professions_list = listBrpProfessions(db);
      break;
    case "list_weapons":
      response.weapons_list = listBrpAllWeapons(db);
      break;
    default:
      response.rules = searchBrpRules(db, searchTerm);
      break;
  }
  return response;
}

function query5e(searchTerm: string, category: string): Record<string, unknown> {
  const db = ensure5ecompatibleSchema(ensure5ecompatibleDb().dbPath);
  const response: Record<string, unknown> = {};

  switch (category) {
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
    case "categories":
      response.categories = CATEGORY_FILTERS["5ecompatible"];
      break;
    default:
      response.rules = search5ecompatibleRules(db, searchTerm);
      break;
  }
  return response;
}

function queryOrcus(searchTerm: string, category: string): Record<string, unknown> {
  const db = ensureOrcusSchema(ensureOrcusDb().dbPath);
  const response: Record<string, unknown> = {};

  switch (category) {
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
    case "categories":
      response.categories = CATEGORY_FILTERS.orcus;
      break;
    default:
      response.rules = searchOrcusRules(db, searchTerm);
      break;
  }
  return response;
}

export async function handleQueryRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const system = typeof args?.system === "string" ? args.system : "";
  if (!isNamedSystem(system)) {
    return jsonResult(
      { error: `system is required and must be one of: ${RULES_SYSTEMS.join(", ")}` },
      true
    );
  }

  const searchTerm = typeof args?.search_term === "string" ? args.search_term : "";
  const category = typeof args?.category === "string" ? args.category.toLowerCase() : "";

  let response: Record<string, unknown>;
  switch (system) {
    case "ogl":
      response = queryOgl(searchTerm, category);
      break;
    case "dw":
      response = queryDw(searchTerm, category);
      break;
    case "brp":
      response = queryBrp(searchTerm, category);
      break;
    case "5ecompatible":
      response = query5e(searchTerm, category);
      break;
    case "orcus":
      response = queryOrcus(searchTerm, category);
      break;
  }

  return jsonResult({ system, category: category || "rules", ...response });
}
