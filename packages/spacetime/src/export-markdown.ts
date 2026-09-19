// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type { ChronicleBrief } from "./types.js";

export function renderChronicleMarkdown(brief: ChronicleBrief): string {
  const lines: string[] = [
    `# Chronicle brief — ${brief.table_label}`,
    "",
    `_Generated ${new Date(brief.generated_at).toISOString()} without an LLM._`,
    "",
    "## Open threads",
    "",
  ];
  if (brief.open_threads.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const thread of brief.open_threads) {
      lines.push(`- **${thread.title}** (${thread.status}, priority ${thread.priority}) — ${thread.summary || "no summary"}`);
    }
    lines.push("");
  }
  lines.push("## Recent beats", "");
  if (brief.recent_beats.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const beat of brief.recent_beats) {
      lines.push(
        `- [${beat.kind}/${beat.confidence}] ${beat.text}`
      );
    }
    lines.push("");
  }
  lines.push("## Hot entities", "");
  if (brief.hot_entities.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const entity of brief.hot_entities) {
      lines.push(`- **${entity.name}** (${entity.type}, ${entity.confidence}) ${entity.notes}`.trim());
    }
    lines.push("");
  }
  lines.push("## Ready hooks", "");
  if (brief.ready_hooks.length === 0) {
    lines.push("_None._", "");
  } else {
    for (const hook of brief.ready_hooks) {
      lines.push(`- ${hook.text}`);
    }
    lines.push("");
  }
  lines.push("Draft export only. Do not auto-post.");
  return `${lines.join("\n")}\n`;
}
