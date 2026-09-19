// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { EmbeddedStore } from "./kernel.js";
import { SpacetimeSnapshotClient } from "./client.js";
import type { OpenStoreOptions } from "./types.js";

export type SessionStore = EmbeddedStore;

const stores = new Map<string, SessionStore>();
const remotes = new Map<string, SpacetimeSnapshotClient>();

export function shouldPersistPath(path: string | undefined): boolean {
  if (!path) return false;
  const lower = path.toLowerCase();
  return !lower.endsWith(".db") && !lower.endsWith(".sqlite") && !lower.endsWith(".sqlite3");
}

export function getOrOpenStore(options: OpenStoreOptions): SessionStore {
  const existing = stores.get(options.isolationKey);
  if (existing) return existing;

  const persistPath =
    options.persistPath ?? (shouldPersistPath(options.isolationKey) ? options.isolationKey : undefined);
  const persist = options.persist ?? Boolean(persistPath && shouldPersistPath(persistPath));

  const store = new EmbeddedStore({ persist, persistPath });
  stores.set(options.isolationKey, store);

  if (options.mode === "remote") {
    remotes.set(
      options.isolationKey,
      new SpacetimeSnapshotClient({
        uri: options.uri ?? "http://127.0.0.1:3000",
        database: options.database ?? "2d6mcp",
        token: options.token,
      })
    );
  }

  return store;
}

export function getSnapshotClient(isolationKey: string): SpacetimeSnapshotClient | undefined {
  return remotes.get(isolationKey);
}

export async function hydrateStore(isolationKey: string): Promise<boolean> {
  const store = stores.get(isolationKey);
  const remote = remotes.get(isolationKey);
  if (!store || !remote) return false;
  const snapshot = await remote.load();
  if (!snapshot) return false;
  store.loadSnapshot(snapshot);
  store.persistIfNeeded();
  return true;
}

export async function flushStore(isolationKey: string): Promise<void> {
  const store = stores.get(isolationKey);
  const remote = remotes.get(isolationKey);
  if (!store || !remote) return;
  await remote.save(store.snapshot());
}

export function closeStore(isolationKey?: string): void {
  if (isolationKey) {
    stores.delete(isolationKey);
    remotes.delete(isolationKey);
    return;
  }
  stores.clear();
  remotes.clear();
}

export function listOpenStoreKeys(): string[] {
  return [...stores.keys()];
}
