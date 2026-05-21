#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { startServer } from "./server.js";

async function main(): Promise<void> {
  await startServer();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Fatal error";
  process.stderr.write(`2d6mcp: ${message}\n`);
  process.exit(1);
});
