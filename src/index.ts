#!/usr/bin/env node

import { startServer } from "./server.js";

async function main(): Promise<void> {
  await startServer();
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "Fatal error";
  process.stderr.write(`2d6mcp: ${message}\n`);
  process.exit(1);
});
