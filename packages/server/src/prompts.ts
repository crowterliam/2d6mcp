// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { McpError, ErrorCode, type GetPromptResult, type Prompt } from "@modelcontextprotocol/sdk/types.js";

export const PROMPT_NAMES = [
  "skill-check",
  "d20-check",
  "percentile-check",
  "lookup-rules",
  "create-character",
  "start-session",
  "ask-ruling",
  "index-documents",
] as const;

export type PromptName = (typeof PROMPT_NAMES)[number];

const PROMPT_SET = new Set<string>(PROMPT_NAMES);

export function isPromptName(name: string): name is PromptName {
  return PROMPT_SET.has(name);
}

function arg(args: Record<string, string> | undefined, key: string, fallback = ""): string {
  const value = args?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function userPrompt(description: string, text: string): GetPromptResult {
  return {
    description,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

export function getPromptDefinitions(): Prompt[] {
  return [
    {
      name: "skill-check",
      title: "2d6 skill check",
      description: "Resolve a 2d6 task check with modifier and target number using the roll tool.",
      arguments: [
        { name: "modifier", description: "Modifier added to 2d6 (default 0)", required: false },
        { name: "target", description: "Target number (default 8)", required: false },
        { name: "task", description: "What the character is attempting", required: false },
      ],
    },
    {
      name: "d20-check",
      title: "d20 check",
      description: "Resolve a d20 attack or ability check, optionally vs AC/DC, with advantage or disadvantage.",
      arguments: [
        { name: "modifier", description: "Attack or ability modifier (default 0)", required: false },
        { name: "target", description: "Armor Class or Difficulty Class", required: false },
        { name: "advantage", description: "Set to true for advantage", required: false },
        { name: "task", description: "What is being rolled", required: false },
      ],
    },
    {
      name: "percentile-check",
      title: "Percentile check",
      description: "Resolve a d100 roll-under check with critical and fumble detection.",
      arguments: [
        { name: "target", description: "Skill or characteristic percentile to roll under", required: true },
        { name: "skill", description: "Name of the skill or characteristic", required: false },
      ],
    },
    {
      name: "lookup-rules",
      title: "Look up rules",
      description: "Search a licensed rules database, then cite the matching entries.",
      arguments: [
        { name: "system", description: "ogl, dw, brp, 5ecompatible, or orcus", required: true },
        { name: "query", description: "Rules question or search terms", required: true },
        { name: "category", description: "Optional category filter; use categories to list filters", required: false },
      ],
    },
    {
      name: "create-character",
      title: "Create a character",
      description: "Walk through character creation for the chosen rules system using roll and query_rules.",
      arguments: [
        { name: "system", description: "ogl, dw, brp, 5ecompatible, or orcus", required: true },
        { name: "concept", description: "Character concept or career/class preference", required: false },
      ],
    },
    {
      name: "start-session",
      title: "Start a game session",
      description: "Start a session, confirm the rules system, and outline table logging.",
      arguments: [
        { name: "name", description: "Session name", required: false },
        { name: "rules_system", description: "ogl, dw, brp, 5ecompatible, or orcus (default ogl)", required: false },
      ],
    },
    {
      name: "ask-ruling",
      title: "Ask for a cited ruling",
      description: "Look up licensed rules (and BYOD when enabled) and synthesize a cited ruling.",
      arguments: [
        { name: "question", description: "The rules question to resolve", required: true },
        { name: "rules_system", description: "ogl, dw, brp, 5ecompatible, orcus, or auto", required: false },
        { name: "session_id", description: "Optional session to scope lookup and log the ruling", required: false },
      ],
    },
    {
      name: "index-documents",
      title: "Index personal documents",
      description: "Index matching top-level BYOD collections on demand. Requires BYOD consent.",
      arguments: [
        { name: "query", description: "Game or collection to index, for example traveller", required: false },
        { name: "relative_path", description: "Optional single file relative to BYOD_PATH", required: false },
      ],
    },
  ];
}

export function getPrompt(name: string, args?: Record<string, string>): GetPromptResult {
  if (!isPromptName(name)) {
    throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
  }
  return renderPrompt(name, args);
}

function renderPrompt(name: PromptName, args?: Record<string, string>): GetPromptResult {
  switch (name) {
    case "skill-check": {
      const modifier = arg(args, "modifier", "0");
      const target = arg(args, "target", "8");
      const task = arg(args, "task", "a standard skill check");
      return userPrompt(
        "Resolve a 2d6 skill check",
        [
          `Resolve ${task} as a 2d6 task check.`,
          `Call the roll tool with mechanic "2d6", modifier ${modifier}, and target ${target}.`,
          "Report individual dice, total, success or failure, and effect margin.",
          "Use system-agnostic language (characteristic, skill, target number). Do not invent numbers that the tool did not return.",
        ].join("\n")
      );
    }
    case "d20-check": {
      const modifier = arg(args, "modifier", "0");
      const target = arg(args, "target");
      const advantage = arg(args, "advantage", "false");
      const task = arg(args, "task", "an attack or ability check");
      const targetLine = target
        ? `Set target to ${target} (Armor Class or Difficulty Class).`
        : "Omit target unless the caller provided an Armor Class or Difficulty Class.";
      return userPrompt(
        "Resolve a d20 check",
        [
          `Resolve ${task} with a d20 roll.`,
          `Call the roll tool with mechanic "d20", modifier ${modifier}, advantage ${advantage}.`,
          targetLine,
          "Report the die (or both dice if advantage/disadvantage), total, hit/miss, and natural 20 / natural 1 if they occur.",
        ].join("\n")
      );
    }
    case "percentile-check": {
      const target = arg(args, "target");
      const skill = arg(args, "skill", "the relevant skill");
      return userPrompt(
        "Resolve a percentile check",
        [
          `Resolve a roll-under check for ${skill}.`,
          `Call the roll tool with mechanic "percentile"${target ? ` and target ${target}` : " and the provided target percentile"}.`,
          "Report tens/ones, total, success or failure, critical success (at or below 5% of the target), and fumble (96–100).",
        ].join("\n")
      );
    }
    case "lookup-rules": {
      const system = arg(args, "system", "ogl");
      const query = arg(args, "query", "the current rules question");
      const category = arg(args, "category");
      return userPrompt(
        "Look up licensed rules",
        [
          `Look up: ${query}`,
          `Call query_rules with system "${system}"${category ? ` and category "${category}"` : ""}.`,
          "If the first search is thin, retry with a shorter keyword or category=categories to see valid filters.",
          "Quote or paraphrase only what the tool returned. If nothing matches, say so instead of inventing a rule.",
        ].join("\n")
      );
    }
    case "create-character": {
      const system = arg(args, "system", "ogl");
      const concept = arg(args, "concept", "an adventurer");
      return userPrompt(
        "Create a character",
        [
          `Create ${concept} for rules system "${system}".`,
          "1. Call query_rules with that system and category=categories, then look up careers, classes, or professions as appropriate.",
          "2. Generate characteristics with the roll tool (2d6 for 2d6 systems; follow the system's own method otherwise).",
          "3. If the user provided a character sheet file, call parse_character instead of inventing stats.",
          "Stay system-agnostic in naming. Do not invent table results that were not rolled.",
        ].join("\n")
      );
    }
    case "start-session": {
      const sessionName = arg(args, "name", "Tonight's game");
      const rulesSystem = arg(args, "rules_system", "ogl");
      return userPrompt(
        "Start a game session",
        [
          `Start a session named "${sessionName}" using rules_system "${rulesSystem}".`,
          'Call session with action "start", the name, and rules_system.',
          "Return the session id. Offer to log_transcript as play proceeds and to synthesize_ruling when a rules question comes up.",
        ].join("\n")
      );
    }
    case "ask-ruling": {
      const question = arg(args, "question", "the current rules question");
      const rulesSystem = arg(args, "rules_system", "auto");
      const sessionId = arg(args, "session_id");
      return userPrompt(
        "Synthesize a cited ruling",
        [
          `Question: ${question}`,
          `Call synthesize_ruling with rules_system "${rulesSystem}"${sessionId ? ` and session_id "${sessionId}"` : ""}.`,
          "If the user wants the question taken from table talk, set from_context true instead of inventing a question.",
          "Present the cited ruling. Do not add numbers that are not in the tool output or source text.",
        ].join("\n")
      );
    }
    case "index-documents": {
      const relativePath = arg(args, "relative_path");
      const query = arg(args, "query");
      return userPrompt(
        "Index personal documents",
        [
          "Index local RPG source files for search. Do not crawl the whole library.",
          "BYOD requires consent (AGREE_BYOD_USE=true or npm run setup) and BYOD_PATH.",
          relativePath
            ? `Call sync_byod with relative_path "${relativePath}".`
            : query
              ? `Call sync_byod with query "${query}". If complete is false, call it again until complete is true.`
              : "Call sync_byod with no arguments to list top-level collections, then sync_byod with query set to the matching game folder. If complete is false, call it again until complete is true.",
          "query_local_byod also indexes matching folders from the search term. Then call list_byod_files to confirm what was indexed. Do not read those files with non-2d6mcp file tools.",
        ].join("\n")
      );
    }
    default: {
      const _never: never = name;
      return _never;
    }
  }
}
