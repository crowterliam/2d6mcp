#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Scan git-tracked files and data/packages trees for vendored PDFs, oversized
// dumps, and closed-content product titles outside attribution files.
// Phrase parts are split so this scanner does not itself contain those titles.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const SKIP_DIR = new Set(["node_modules", "dist", "coverage", ".git"]);
const SKIP_TEXT_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".db",
  ".bin",
  ".gz",
  ".zip",
  ".wasm",
]);

const ATTRIBUTION_FILES = new Set(["LICENSE.md", "AI-POLICY.md"]);

const MAX_OSR_SOURCE_BYTES = 80 * 1024;
const MAX_TREE_TEXT_BYTES = 200 * 1024;

const legacyId = ["o", "s", "e"].join("");

const PRODUCT_IDENTITY_PHRASES = [
  ["Old-School", " Essentials"],
  ["Necrotic", " Gnome"],
  ["AF", " Tomes"],
  ["Advanced Fantasy", " Tomes"],
  ["Black", " Streams"],
  ["Mongoose", " CRB"],
].map((parts) => parts.join(""));

const FLEET_PHRASES = [
  ["Salt", "mere"],
  ["Sunday", "Night"],
  ["Ya", "ni"],
  ["MGT", "2"],
  ["Hetz", "ner"],
  ["Grok", " Bot"],
].map((parts) => parts.join(""));

const LEGACY_ID_PATTERNS = [
  new RegExp(`"${legacyId}"`),
  new RegExp(`'${legacyId}'`),
  new RegExp(`\`${legacyId}\``),
  new RegExp(`packages/${legacyId}\\b`),
  new RegExp(`@2d6mcp/${legacyId}\\b`),
  new RegExp(`data/${legacyId}\\b`),
  new RegExp(`tests/${legacyId}\\b`),
  new RegExp(`populate-${legacyId}\\b`),
  new RegExp(`2d6mcp://rules/${legacyId}`),
  new RegExp(`${["O", "S", "E"].join("")}_DB_PATH`),
  new RegExp(`\\b${["seed", "O", "se"].join("")}\\b`),
];

function listedGitFiles() {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  const extra = execFileSync("git", ["ls-files", "-z", "--others", "--exclude-standard"], {
    encoding: "buffer",
  });
  const names = new Set();
  for (const chunk of [tracked, extra]) {
    for (const name of chunk.toString("utf8").split("\0")) {
      if (name) names.add(name.replace(/\\/g, "/"));
    }
  }
  return [...names];
}

function walkTree(root, acc = []) {
  if (!existsSync(root)) return acc;
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIR.has(entry.name) || entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      walkTree(full, acc);
      continue;
    }
    if (entry.isFile()) acc.push(full);
  }
  return acc;
}

function posixRel(filePath) {
  return relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function main() {
  const problems = [];
  const gitFiles = listedGitFiles();

  const trackedPdfs = gitFiles.filter((f) => extname(f).toLowerCase() === ".pdf");
  if (trackedPdfs.length > 0) {
    problems.push(`Tracked PDF files are not allowed:\n  ${trackedPdfs.join("\n  ")}`);
  }

  for (const tree of ["data", "packages", "tests"]) {
    for (const filePath of walkTree(tree)) {
      if (extname(filePath).toLowerCase() === ".pdf") {
        problems.push(`PDF under ${tree}/ is not allowed: ${posixRel(filePath)}`);
      }
    }
  }

  const osrSources = ["packages/osr/src/populate.ts", "packages/osr/src/schema.sql.ts", "data/osr/NOTICE.txt"];
  for (const rel of osrSources) {
    if (!existsSync(rel)) continue;
    const size = statSync(rel).size;
    if (size > MAX_OSR_SOURCE_BYTES) {
      problems.push(`${rel} is ${size} bytes — too large for original short helpers (max ${MAX_OSR_SOURCE_BYTES})`);
    }
  }

  for (const tree of ["data/osr", "packages/osr"]) {
    for (const filePath of walkTree(tree)) {
      const ext = extname(filePath).toLowerCase();
      if (SKIP_TEXT_EXT.has(ext) || ext === ".pdf") continue;
      if (filePath.includes(`${join("packages", "osr", "dist")}`)) continue;
      let st;
      try {
        st = statSync(filePath);
      } catch {
        continue;
      }
      if (st.size > MAX_TREE_TEXT_BYTES) {
        problems.push(`${posixRel(filePath)} is ${st.size} bytes — possible book dump`);
      }
    }
  }

  for (const file of gitFiles) {
    if (extname(file).toLowerCase() === ".pdf") continue;
    if (SKIP_TEXT_EXT.has(extname(file).toLowerCase())) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const allowProductNames = ATTRIBUTION_FILES.has(file);

    if (!allowProductNames) {
      for (const phrase of PRODUCT_IDENTITY_PHRASES) {
        if (text.includes(phrase) || text.toLowerCase().includes(phrase.toLowerCase())) {
          problems.push(`${file}: closed-content product title "${phrase}" must stay out of code and data`);
        }
      }
    }

    for (const phrase of FLEET_PHRASES) {
      if (text.includes(phrase) || text.toLowerCase().includes(phrase.toLowerCase())) {
        problems.push(`${file}: forbidden personal/fleet identifier`);
      }
    }

    for (const pattern of LEGACY_ID_PATTERNS) {
      if (pattern.test(text)) {
        problems.push(`${file}: forbidden legacy system id pattern ${pattern}`);
      }
    }
  }

  const license = existsSync("LICENSE.md") ? readFileSync("LICENSE.md", "utf8") : "";
  for (const phrase of PRODUCT_IDENTITY_PHRASES) {
    if (!license.includes(phrase)) {
      problems.push(`LICENSE.md must list Product Identity exclusion for "${phrase}"`);
    }
  }
  if (!/BYOD/.test(license) || !/osr/.test(license)) {
    problems.push("LICENSE.md must document osr helpers as AGPL plus full books via BYOD only");
  }

  const policy = existsSync("AI-POLICY.md") ? readFileSync("AI-POLICY.md", "utf8") : "";
  if (!/BYOD/.test(policy) || !/never uploaded/i.test(policy)) {
    problems.push("AI-POLICY.md must state BYOD is local-only and never uploaded");
  }
  if (!/osr/.test(policy)) {
    problems.push("AI-POLICY.md must document osr as original mechanical helpers, not commercial books");
  }

  if (problems.length > 0) {
    console.error("Licensing firewall failed:\n" + problems.join("\n"));
    process.exit(1);
  }

  console.log("Licensing firewall: ok");
}

main();
