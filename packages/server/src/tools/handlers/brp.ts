// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// This work created using the BRP Open Game License.
// Basic Roleplaying (c) copyright 1980-2020 Chaosium Inc.
// Basic Roleplaying and the BRP logo are trademarks of Chaosium Inc.
// Used with permission.

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
import { ensureBrpDb } from "../helpers.js";

export async function handleQueryBrpRules(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const searchTerm =
    typeof args?.search_term === "string" ? args.search_term : "";
  const category =
    typeof args?.category === "string" ? args.category : "";

  const { dbPath } = ensureBrpDb();
  const db = ensureBrpSchema(dbPath);

  const response: Record<string, unknown> = {};

  switch (category.toLowerCase()) {
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
      response.categories = listBrpCategories(db);
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
    case "rules":
      response.rules = searchBrpRules(db, searchTerm);
      break;
    default:
      response.rules = searchBrpRules(db, searchTerm);
      response.characteristics = searchBrpCharacteristics(db, searchTerm);
      response.skills = searchBrpSkills(db, searchTerm);
      response.professions = searchBrpProfessions(db, searchTerm);
      response.melee_weapons = searchBrpWeaponsMelee(db, searchTerm);
      response.missile_weapons = searchBrpWeaponsMissile(db, searchTerm);
      response.armor = searchBrpArmor(db, searchTerm);
      response.shields = searchBrpShields(db, searchTerm);
      response.spot_rules = searchBrpSpotRules(db, searchTerm);
      break;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}
