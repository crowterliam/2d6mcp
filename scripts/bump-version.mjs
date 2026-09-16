#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Lockstep SemVer helper for the 2d6mcp monorepo.
// Root package.json is the source of truth; every packages/*/package.json
// (and MCP registry metadata in server.json) must share the same version.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const BUMP_KINDS = /** @type {const} */ (["major", "minor", "patch"]);

/**
 * @typedef {"package" | "server-json" | "lockfile"} VersionFileKind
 * @typedef {{ path: string; kind: VersionFileKind; label: string }} VersionFile
 * @typedef {{ file: string; version: string }} VersionRecord
 */

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} version
 * @returns {{ major: number; minor: number; patch: number }}
 */
export function parseSemver(version) {
  const match = SEMVER_RE.exec(version);
  if (!match) {
    throw new Error(`Not a SemVer X.Y.Z version: ${JSON.stringify(version)}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * @param {string} version
 * @param {"major" | "minor" | "patch"} kind
 * @param {{ force?: boolean }} [opts]
 */
export function bumpSemver(version, kind, opts = {}) {
  const parsed = parseSemver(version);
  switch (kind) {
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "major":
      if (parsed.major === 0 && !opts.force) {
        throw new Error(
          "On 0.x, breaking changes bump minor (unstable API). " +
            "Use: npm run version:bump -- minor\n" +
            "To cut 1.0.0, pass --force: npm run version:bump -- major --force"
        );
      }
      return `${parsed.major + 1}.0.0`;
    default: {
      const exhaustive = /** @type {never} */ (kind);
      throw new Error(`Unknown bump kind: ${exhaustive}`);
    }
  }
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function listWorkspacePackageJsons(root) {
  const rootPkgPath = join(root, "package.json");
  const rootPkg = JSON.parse(readFileSync(rootPkgPath, "utf8"));
  const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
  const files = [rootPkgPath];

  for (const pattern of workspaces) {
    if (!pattern.endsWith("/*")) {
      throw new Error(`Unsupported workspaces pattern: ${pattern}`);
    }
    const dir = join(root, pattern.slice(0, -2));
    if (!existsSync(dir)) continue;
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of entries) {
      const pkgPath = join(dir, name, "package.json");
      if (existsSync(pkgPath)) files.push(pkgPath);
    }
  }

  return files;
}

/**
 * @param {string} root
 * @returns {VersionFile[]}
 */
export function collectVersionFiles(root) {
  /** @type {VersionFile[]} */
  const files = listWorkspacePackageJsons(root).map((path) => ({
    path,
    kind: "package",
    label: relative(root, path).replace(/\\/g, "/") || "package.json",
  }));

  const serverJson = join(root, "server.json");
  if (existsSync(serverJson)) {
    files.push({
      path: serverJson,
      kind: "server-json",
      label: "server.json",
    });
  }

  const lockfile = join(root, "package-lock.json");
  if (existsSync(lockfile)) {
    files.push({
      path: lockfile,
      kind: "lockfile",
      label: "package-lock.json",
    });
  }

  return files;
}

/**
 * @param {string} text
 * @param {string} version
 */
function countExactVersionFields(text, version) {
  const pattern = new RegExp(`"version"\\s*:\\s*"${escapeRegExp(version)}"`, "g");
  return text.match(pattern)?.length ?? 0;
}

/**
 * @param {VersionFile} file
 * @returns {string[]}
 */
export function readVersionsFromFile(file) {
  const raw = JSON.parse(readFileSync(file.path, "utf8"));
  switch (file.kind) {
    case "package":
      return [typeof raw.version === "string" ? raw.version : ""];
    case "server-json": {
      const versions = [typeof raw.version === "string" ? raw.version : ""];
      if (Array.isArray(raw.packages)) {
        for (const pkg of raw.packages) {
          if (pkg && typeof pkg.version === "string") versions.push(pkg.version);
        }
      }
      return versions;
    }
    case "lockfile": {
      const versions = [typeof raw.version === "string" ? raw.version : ""];
      const packages = raw.packages && typeof raw.packages === "object" ? raw.packages : {};
      if (packages[""] && typeof packages[""].version === "string") {
        versions.push(packages[""].version);
      }
      for (const [key, pkg] of Object.entries(packages)) {
        if (!/^packages\/[^/]+$/.test(key)) continue;
        if (pkg && typeof pkg.version === "string") versions.push(pkg.version);
      }
      return versions;
    }
    default: {
      const exhaustive = /** @type {never} */ (file.kind);
      throw new Error(`Unknown version file kind: ${exhaustive}`);
    }
  }
}

/**
 * @param {string} root
 * @returns {{ version: string; records: VersionRecord[] }}
 */
export function assertLockstep(root) {
  const files = collectVersionFiles(root);
  if (files.length === 0) {
    throw new Error("No version files found");
  }

  /** @type {VersionRecord[]} */
  const records = [];
  for (const file of files) {
    const versions = readVersionsFromFile(file);
    if (versions.length === 0) {
      throw new Error(`No version fields in ${file.label}`);
    }
    for (const version of versions) {
      parseSemver(version);
      records.push({ file: file.label, version });
    }
  }

  const rootVersion = records[0]?.version;
  const drifted = records.filter((record) => record.version !== rootVersion);
  if (!rootVersion || drifted.length > 0) {
    const lines = records.map((record) => `  ${record.file}: ${record.version}`).join("\n");
    throw new Error(`Workspace versions drifted from lockstep:\n${lines}`);
  }

  return { version: rootVersion, records };
}

/**
 * @param {string} text
 * @param {string} oldVersion
 * @param {string} newVersion
 * @param {string} label
 * @param {number} expected
 */
function replaceExactVersionFields(text, oldVersion, newVersion, label, expected) {
  const count = countExactVersionFields(text, oldVersion);
  if (count !== expected) {
    throw new Error(
      `${label} has ${count} "version": "${oldVersion}" field(s); expected ${expected}. ` +
        "Refusing to rewrite so third-party versions cannot drift."
    );
  }
  const pattern = new RegExp(`("version"\\s*:\\s*")${escapeRegExp(oldVersion)}(")`, "g");
  return text.replace(pattern, `$1${newVersion}$2`);
}

/**
 * @param {string} root
 * @param {string} newVersion
 * @param {{ dryRun?: boolean }} [opts]
 * @returns {{ from: string; to: string; files: string[] }}
 */
export function applyVersion(root, newVersion, opts = {}) {
  parseSemver(newVersion);
  const current = assertLockstep(root);
  if (current.version === newVersion) {
    throw new Error(`Already at ${newVersion}`);
  }

  const files = collectVersionFiles(root);
  const workspacePackageCount = files.filter((file) => file.kind === "package").length;
  /** @type {string[]} */
  const written = [];

  for (const file of files) {
    const text = readFileSync(file.path, "utf8");
    let expected;
    switch (file.kind) {
      case "package":
        expected = 1;
        break;
      case "server-json":
        expected = readVersionsFromFile(file).length;
        break;
      case "lockfile":
        // root + packages[""] + each workspace package entry
        expected = 2 + (workspacePackageCount - 1);
        break;
      default: {
        const exhaustive = /** @type {never} */ (file.kind);
        throw new Error(`Unknown version file kind: ${exhaustive}`);
      }
    }

    const next = replaceExactVersionFields(text, current.version, newVersion, file.label, expected);
    if (!opts.dryRun) {
      writeFileSync(file.path, next);
    }
    written.push(file.label);
  }

  return { from: current.version, to: newVersion, files: written };
}

export function usage() {
  return `Lockstep version tool for the 2d6mcp monorepo.

Usage:
  node scripts/bump-version.mjs check
  node scripts/bump-version.mjs bump <major|minor|patch> [--force] [--dry-run]
  node scripts/bump-version.mjs set <x.y.z> [--dry-run]

npm:
  npm run version:check
  npm run version:bump -- patch|minor|major

On 0.x, breaking changes bump minor (unstable API). major is refused
unless --force (cuts 1.0.0). Do not npm publish from this script.
After a real bump: update CHANGELOG.md, commit, PR, then tag vX.Y.Z on main.
`;
}

/**
 * @param {string[]} argv
 */
export function parseCliArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  return {
    command: positional[0] ?? "",
    rest: positional.slice(1),
    force: flags.has("--force"),
    dryRun: flags.has("--dry-run"),
    help: flags.has("--help") || flags.has("-h"),
  };
}

/**
 * @param {string[]} argv
 * @param {{ root?: string; stdout?: (line: string) => void }} [env]
 */
export function runCli(argv, env = {}) {
  const root = env.root ?? REPO_ROOT;
  const log = env.stdout ?? ((line) => console.log(line));
  const args = parseCliArgs(argv);

  if (args.help || args.command === "help" || args.command === "") {
    log(usage().trimEnd());
    if (args.command === "" && !args.help) {
      throw new Error("Missing command. See usage above.");
    }
    return 0;
  }

  switch (args.command) {
    case "check": {
      const result = assertLockstep(root);
      const packageCount = result.records.filter((record) => record.file.endsWith("package.json")).length;
      log(`Version lockstep: ok (${result.version}, ${packageCount} package.json files)`);
      return 0;
    }
    case "bump": {
      const kind = args.rest[0];
      if (!BUMP_KINDS.includes(/** @type {(typeof BUMP_KINDS)[number]} */ (kind))) {
        throw new Error(`bump requires one of: ${BUMP_KINDS.join("|")}`);
      }
      const current = assertLockstep(root);
      const next = bumpSemver(current.version, /** @type {(typeof BUMP_KINDS)[number]} */ (kind), {
        force: args.force,
      });
      const applied = applyVersion(root, next, { dryRun: args.dryRun });
      log(
        `${args.dryRun ? "Dry run" : "Bumped"} lockstep version ${applied.from} → ${applied.to}`
      );
      log(`Files: ${applied.files.join(", ")}`);
      if (!args.dryRun) {
        log("Next: move Unreleased notes in CHANGELOG.md, commit, PR, then tag v" + applied.to + " after merge.");
        log("Do not npm publish or create a GitHub Release that auto-publishes.");
      }
      return 0;
    }
    case "set": {
      const version = args.rest[0];
      if (!version) throw new Error("set requires a SemVer X.Y.Z version");
      const applied = applyVersion(root, version, { dryRun: args.dryRun });
      log(
        `${args.dryRun ? "Dry run" : "Set"} lockstep version ${applied.from} → ${applied.to}`
      );
      log(`Files: ${applied.files.join(", ")}`);
      return 0;
    }
    default:
      throw new Error(`Unknown command: ${args.command}`);
  }
}

function isDirectCli() {
  const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
  return import.meta.url === entry;
}

if (isDirectCli()) {
  try {
    const code = runCli(process.argv.slice(2));
    process.exitCode = code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
