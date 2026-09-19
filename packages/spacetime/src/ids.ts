// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newSessionId(): string {
  return `session-${Date.now()}-${randomSuffix().slice(0, 6)}`;
}

export function newThreadId(): string {
  return `thr-${Date.now()}-${randomSuffix()}`;
}

export function newBeatId(): string {
  return `beat-${Date.now()}-${randomSuffix()}`;
}

export function newEntityId(): string {
  return `ent-${Date.now()}-${randomSuffix()}`;
}

export function newLinkId(): string {
  return `lnk-${Date.now()}-${randomSuffix()}`;
}

export function newHookId(): string {
  return `hook-${Date.now()}-${randomSuffix()}`;
}

export function cursorKey(sessionId: string, sourceKind: string, sourceKey: string): string {
  return `${sessionId}\0${sourceKind}\0${sourceKey}`;
}
