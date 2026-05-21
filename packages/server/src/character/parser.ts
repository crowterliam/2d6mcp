// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { z } from "zod";

export interface CharacterStats {
  upp: string;
  characteristics: Record<string, number>;
  skills: { name: string; level: number }[];
  name: string | null;
  career: string | null;
  raw: string;
}

const UPP_PATTERN = /[A-F0-9]{6}/;
const CHAR_NAMES = [
  "strength",
  "dexterity",
  "endurance",
  "intelligence",
  "education",
  "social",
];

function hexToDecimal(hex: string): number {
  const val = parseInt(hex, 16);
  if (isNaN(val)) return 0;
  return val;
}

function parseUpp(upp: string): Record<string, number> {
  const chars = upp.toUpperCase().split("");
  const result: Record<string, number> = {};
  for (let i = 0; i < Math.min(chars.length, CHAR_NAMES.length); i++) {
    result[CHAR_NAMES[i]] = hexToDecimal(chars[i]);
  }
  return result;
}

export function extractUpp(text: string): string | null {
  const match = text.replace(/\s/g, "").match(UPP_PATTERN);
  return match ? match[0] : null;
}

export function parseCharacterText(text: string): CharacterStats {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let name: string | null = null;
  let career: string | null = null;
  let uppStr: string | null = null;
  const skills: { name: string; level: number }[] = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (lowerLine.startsWith("name:")) {
      name = line.slice(5).trim();
      continue;
    }
    if (lowerLine.startsWith("career:")) {
      career = line.slice(7).trim();
      continue;
    }
    if (lowerLine.startsWith("upp:")) {
      uppStr = line.slice(4).trim().replace(/\s/g, "");
      continue;
    }

    const uppMatch = line.replace(/\s/g, "").match(UPP_PATTERN);
    if (uppMatch && !uppStr) {
      uppStr = uppMatch[0];
      career = career || line.replace(uppMatch[0], "").trim();
      continue;
    }

    const skillMatch = line.match(/^(.+?)\s*[-:]\s*(\d+)\s*$/);
    if (skillMatch) {
      skills.push({
        name: skillMatch[1].trim(),
        level: parseInt(skillMatch[2], 10),
      });
    }
  }

  const characteristics = uppStr
    ? parseUpp(uppStr)
    : {};

  return {
    upp: uppStr || "??????",
    characteristics,
    skills,
    name,
    career,
    raw: text,
  };
}

export function readCharacterFile(content: string, filePath: string): CharacterStats {
  const stats = parseCharacterText(content);
  if (!stats.name) {
    const basename = filePath.split("/").pop()?.split("\\").pop() || "";
    stats.name = basename.replace(/\.[^.]+$/, "");
  }
  return stats;
}

export const ParseCharacterInput = z.object({
  file_path: z.string().describe("Path to a character sheet file (text or JSON)"),
});
