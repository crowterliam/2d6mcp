import { describe, it, expect } from "vitest";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { dispatchToolCall, getToolDefinitions } from "../../packages/server/src/tools/index.js";

const NEW_TOOLS = [
  "roll",
  "roll_table",
  "query_rules",
  "query_local_byod",
  "sync_byod",
  "clear_byod",
  "list_byod_files",
  "get_byod_chunk",
  "parse_character",
  "discord_post",
  "discord_webhook",
  "session",
  "log_transcript",
  "get_session_context",
  "search_transcript",
  "synthesize_ruling",
  "transcribe_audio",
];

const OLD_TOOLS = [
  "roll_2d6",
  "roll_d20",
  "roll_percentile",
  "roll_damage",
  "roll_custom",
  "query_ogl_rules",
  "query_dw_rules",
  "query_brp_rules",
  "query_5ecompatible_rules",
  "query_orcus_rules",
  "sync_file",
  "inspect_byod_file",
  "discord_add_webhook",
  "discord_remove_webhook",
  "discord_list_webhooks",
  "discord_test_webhook",
  "session_start",
  "session_end",
  "session_list",
  "session_summarize",
  "delete_session",
  "resolve_from_context",
  "list_transcriptions",
  "clear_transcription",
  "roll_byod_table",
  "list_byod_tables",
];

describe("collapsed MCP catalog", () => {
  it("advertises the new tool names", () => {
    const names = getToolDefinitions().map((t) => t.name);
    for (const name of NEW_TOOLS) {
      expect(names).toContain(name);
    }
    expect(names).toHaveLength(NEW_TOOLS.length);
  });

  it("does not advertise removed tool names", () => {
    const names = getToolDefinitions().map((t) => t.name);
    for (const name of OLD_TOOLS) {
      expect(names).not.toContain(name);
    }
  });

  it("hides BYOD tools when consent is off", () => {
    const names = getToolDefinitions({ byodConsented: false }).map((t) => t.name);
    expect(names).not.toContain("query_local_byod");
    expect(names).not.toContain("sync_byod");
    expect(names).not.toContain("clear_byod");
    expect(names).not.toContain("list_byod_files");
    expect(names).not.toContain("get_byod_chunk");
    expect(names).toContain("roll");
    expect(names).toContain("query_rules");
  });

  it("throws MethodNotFound for old tool names", async () => {
    for (const name of ["roll_2d6", "query_ogl_rules", "session_start", "resolve_from_context"]) {
      await expect(dispatchToolCall(name, {})).rejects.toMatchObject({
        code: ErrorCode.MethodNotFound,
      });
      await expect(dispatchToolCall(name, {})).rejects.toBeInstanceOf(McpError);
    }
  });

  it("dispatches roll", async () => {
    const result = await dispatchToolCall("roll", { notation: "2d6", mechanic: "2d6", target: 8 });
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text) as { dice: number[]; total: number };
    expect(parsed.dice).toHaveLength(2);
    expect(parsed.total).toBeGreaterThanOrEqual(2);
  });
});
