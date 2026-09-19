// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import type { KernelSnapshot } from "./types.js";

const SNAPSHOT_REDUCER = "apply_kernel_snapshot";

export interface SpacetimeClientOptions {
  uri: string;
  database: string;
  token?: string;
}

export function stripTrailingSlashes(uri: string): string {
  let end = uri.length;
  while (end > 0 && uri.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return uri.slice(0, end);
}

/**
 * HTTP client for a published 2d6mcp SpacetimeDB module.
 * The MCP server runs the TypeScript kernel in-process and uses this
 * transport to hydrate/flush the durable replica when SPACETIMEDB_URI is set.
 */
export class SpacetimeSnapshotClient {
  private readonly uri: string;
  private readonly database: string;
  private readonly token: string | undefined;

  constructor(opts: SpacetimeClientOptions) {
    this.uri = stripTrailingSlashes(opts.uri);
    this.database = opts.database;
    this.token = opts.token;
  }

  private headers(json = true): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) headers["content-type"] = "application/json";
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    return headers;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.uri}/v1/database/${encodeURIComponent(this.database)}`, {
        headers: this.headers(false),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async save(snapshot: KernelSnapshot): Promise<void> {
    const url = `${this.uri}/v1/database/${encodeURIComponent(this.database)}/call/${SNAPSHOT_REDUCER}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ json: JSON.stringify(snapshot) }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SpacetimeDB ${SNAPSHOT_REDUCER} failed (${response.status}): ${body}`);
    }
  }

  async load(): Promise<KernelSnapshot | null> {
    const url = `${this.uri}/v1/database/${encodeURIComponent(this.database)}/sql`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(false),
      body: "SELECT json FROM kernel_snapshot WHERE id = 1",
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SpacetimeDB snapshot load failed (${response.status}): ${body}`);
    }
    const parsed = (await response.json()) as unknown;
    const rows = extractSqlRows(parsed);
    const json = rows[0]?.json;
    if (typeof json !== "string" || !json) return null;
    const snapshot = JSON.parse(json) as KernelSnapshot;
    return snapshot?.version === 1 ? snapshot : null;
  }

  async callReducer(name: string, args: unknown): Promise<unknown> {
    const url = `${this.uri}/v1/database/${encodeURIComponent(this.database)}/call/${encodeURIComponent(name)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SpacetimeDB reducer ${name} failed (${response.status}): ${body}`);
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }
}

function extractSqlRows(parsed: unknown): Array<{ json?: string }> {
  if (Array.isArray(parsed)) {
    return parsed.flatMap((block) => {
      if (block && typeof block === "object" && Array.isArray((block as { rows?: unknown }).rows)) {
        return (block as { rows: Array<{ json?: string }> }).rows;
      }
      return [];
    });
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)) {
    return (parsed as { rows: Array<{ json?: string }> }).rows;
  }
  return [];
}
