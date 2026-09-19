// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { runLiveTranscript } from "../../live-transcript/ingest.js";

export async function handleIngestLiveTranscript(
  args: Record<string, unknown> | undefined
): Promise<{
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}> {
  const result = runLiveTranscript(args);
  return {
    content: [{ type: "text", text: JSON.stringify(result.payload, null, 2) }],
    isError: result.ok ? undefined : true,
  };
}
