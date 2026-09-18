// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Operator presets for commercial-style printed 2d6 target numbers.
// These are NOT open-srd (system=ogl) difficulty DM tables.

export const PRINTED_TARGET_PRESETS = {
  average: 8,
  difficult: 10,
  very_difficult: 12,
  impossible: 16,
} as const;

export type PrintedTargetLabel = keyof typeof PRINTED_TARGET_PRESETS;

export const PRINTED_TARGET_LABELS: PrintedTargetLabel[] = [
  "average",
  "difficult",
  "very_difficult",
  "impossible",
];

export const PRINTED_TARGET_PRESET_NOTE =
  "Operator preset for commercial-style printed targets (skill + characteristic vs the printed number). Not an open-srd (system=ogl) difficulty DM table. Do not apply open-srd DMs on top of this target.";

const LABEL_ALIASES: Record<string, PrintedTargetLabel> = {
  average: "average",
  avg: "average",
  difficult: "difficult",
  very_difficult: "very_difficult",
  verydifficult: "very_difficult",
  impossible: "impossible",
};

export function normalizePrintedTargetLabel(raw: string): PrintedTargetLabel | null {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return LABEL_ALIASES[key] ?? null;
}

export function resolvePrintedTarget(raw: string): {
  label: PrintedTargetLabel;
  target: number;
  note: string;
} | null {
  const label = normalizePrintedTargetLabel(raw);
  if (!label) return null;
  return {
    label,
    target: PRINTED_TARGET_PRESETS[label],
    note: PRINTED_TARGET_PRESET_NOTE,
  };
}
