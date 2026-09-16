#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Scan tracked and untracked (non-ignored) files for vendored PDFs and
// identifiers this public repo must not ship. Phrase parts are split so
// this file itself does not contain the forbidden strings.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const SKIP_EXT = new Set([
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
]);

const legacyId = ["o", "s", "e"].join("");

const FORBIDDEN_PHRASES = [
  ["Old-School", " Essentials"],
  ["Necrotic", " Gnome"],
  ["AF", " Tomes"],
  ["Advanced Fantasy", " Tomes"],
  ["Black", " Streams"],
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

function listedFiles() {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  const extra = execFileSync("git", ["ls-files", "-z", "--others", "--exclude-standard"], {
    encoding: "buffer",
  });
  const names = new Set();
  for (const chunk of [tracked, extra]) {
    for (const name of chunk.toString("utf8").split("\0")) {
      if (name) names.add(name);
    }
  }
  return [...names];
}

function main() {
  const files = listedFiles();
  const pdfs = files.filter((f) => extname(f).toLowerCase() === ".pdf");
  const problems = [];

  if (pdfs.length > 0) {
    problems.push(`Vendored PDF files are not allowed:\n  ${pdfs.join("\n  ")}`);
  }

  for (const file of files) {
    if (extname(file).toLowerCase() === ".pdf") continue;
    if (SKIP_EXT.has(extname(file).toLowerCase())) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }

    for (const phrase of FORBIDDEN_PHRASES) {
      if (text.includes(phrase) || text.toLowerCase().includes(phrase.toLowerCase())) {
        problems.push(`${file}: forbidden identifier "${phrase}"`);
      }
    }

    for (const pattern of LEGACY_ID_PATTERNS) {
      if (pattern.test(text)) {
        problems.push(`${file}: forbidden legacy system id pattern ${pattern}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error("Licensing firewall failed:\n" + problems.join("\n"));
    process.exit(1);
  }

  console.log("Licensing firewall: ok");
}

main();
