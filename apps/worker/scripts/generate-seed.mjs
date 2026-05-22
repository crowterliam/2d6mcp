#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Generates seed.sql from the OGL and DW SQLite databases.
// Called by setup-cloud.mjs. Outputs to apps/worker/src/db/seed.sql.

import Database from "better-sqlite3";
import { resolve, dirname } from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const ogl = new Database(resolve(projectRoot, "data", "ogl", "cepheus.db"), { readonly: true });
const dw = new Database(resolve(projectRoot, "data", "dw", "dungeon-world.db"), { readonly: true });

function esc(s: string): string {
  return (s || "").replace(/'/g, "''");
}

const out: string[] = [];

const oglTables = ["core_rules", "skills", "careers", "equipment", "combat", "starship_operations", "world_building"];
for (const t of oglTables) {
  const rows = ogl.prepare("SELECT * FROM " + t).all() as Record<string, string>[];
  for (const r of rows) {
    const title = r.name || r.topic || r.section || "unknown";
    const content = r.description || r.content || "";
    out.push(`INSERT INTO ogl_rules_fts (title, category, content, source_tag) VALUES ('${esc(title.substring(0, 200))}', '${esc(t)}', '${esc(content.substring(0, 8000))}', 'OGL ${t.replace(/_/g, " ")}: ${esc(title.substring(0, 200))}');`);
  }
}

const dwTables = ["dw_moves", "dw_classes", "dw_spells", "dw_equipment", "dw_monsters", "dw_gm_tools"];
for (const t of dwTables) {
  const rows = dw.prepare("SELECT * FROM " + t).all() as Record<string, string>[];
  for (const r of rows) {
    const title = r.name || r.topic || "unknown";
    const content = r.description || r.content || "";
    const tag = t.replace("dw_", "").replace(/_/g, " ");
    out.push(`INSERT INTO dw_rules_fts (title, category, content, source_tag) VALUES ('${esc(title.substring(0, 200))}', '${esc(t)}', '${esc(content.substring(0, 8000))}', 'DW ${tag}: ${esc(title.substring(0, 200))}');`);
  }
}

ogl.close();
dw.close();

const outputPath = resolve(projectRoot, "apps", "worker", "src", "db", "seed.sql");
writeFileSync(outputPath, out.join("\n"));
console.log(`Wrote ${out.length} INSERT statements to apps/worker/src/db/seed.sql`);
