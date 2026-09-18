// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Generic operator target-number presets for 2d6 rolls.

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
  "Operator target preset (average=8, difficult=10, very_difficult=12, impossible=16). Ignored when target is set.";

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
