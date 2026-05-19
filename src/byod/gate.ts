// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { loadConfig, BYOD_DISCLAIMER, isByodEnabled } from "../config.js";

export function checkByodConsent(): { allowed: boolean; message: string } {
  const { byodConsented } = loadConfig();

  if (!byodConsented) {
    return { allowed: false, message: BYOD_DISCLAIMER };
  }

  if (!isByodEnabled()) {
    return {
      allowed: false,
      message:
        'BYOD Mode is partially enabled (consent accepted) but no BYOD_PATH is set or the path does not exist. Please set BYOD_PATH to a valid directory containing your local source files.',
    };
  }

  return { allowed: true, message: "BYOD Mode enabled." };
}

export function getByodPath(): string {
  const { byodPath } = loadConfig();
  return byodPath || "";
}
