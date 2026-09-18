// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { readFileSync, existsSync } from "node:fs";
import { parseCharacterText, readCharacterFile } from "../../character/parser.js";
import { resolveSafePath } from "../helpers.js";

export async function handleParseCharacter(args: Record<string, unknown> | undefined): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const filePath =
    typeof args?.file_path === "string" ? args.file_path : "";
  const sheetText =
    typeof args?.sheet_text === "string"
      ? args.sheet_text
      : typeof args?.text === "string"
        ? args.text
        : "";

  if (!filePath && !sheetText) {
    return {
      content: [
        {
          type: "text",
          text: "Error: file_path or sheet_text is required. file_path must be inside the project directory or BYOD_PATH; otherwise paste the sheet as sheet_text.",
        },
      ],
      isError: true,
    };
  }

  if (sheetText && !filePath) {
    const stats = parseCharacterText(sheetText);
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
    };
  }

  const resolvedPath = resolveSafePath(filePath);

  if (!resolvedPath) {
    return {
      content: [
        {
          type: "text",
          text: "Error: Access denied. File must be within the project directory or your configured BYOD path. Pass sheet_text instead if the client cannot share a local path.",
        },
      ],
      isError: true,
    };
  }

  if (!existsSync(resolvedPath)) {
    return {
      content: [
        {
          type: "text",
          text: `Error: File not found: ${resolvedPath}`,
        },
      ],
      isError: true,
    };
  }

  try {
    const content = readFileSync(resolvedPath, "utf-8");
    const stats = readCharacterFile(content, filePath);
    return {
      content: [
        { type: "text", text: JSON.stringify(stats, null, 2) },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "File read error";
    return {
      content: [
        {
          type: "text",
          text: `Error reading character file: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
