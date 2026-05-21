/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("MLX and session config", () => {
  it("returns default MLX whisper model", () => {
    delete process.env.MLX_WHISPER_MODEL;
    const config = loadConfig();
    expect(config.mlxWhisperModel).toBe("mlx-community/whisper-large-v3-turbo");
  });

  it("returns default MLX LLM model", () => {
    delete process.env.MLX_LLM_MODEL;
    const config = loadConfig();
    expect(config.mlxLLMModel).toBe("mlx-community/Llama-3.2-3B-Instruct-4bit");
  });

  it("reads MLX_WHISPER_MODEL from env", () => {
    process.env.MLX_WHISPER_MODEL = "mlx-community/whisper-tiny";
    const config = loadConfig();
    expect(config.mlxWhisperModel).toBe("mlx-community/whisper-tiny");
  });

  it("reads MLX_LLM_MODEL from env", () => {
    process.env.MLX_LLM_MODEL = "mlx-community/gemma-2-9b-it";
    const config = loadConfig();
    expect(config.mlxLLMModel).toBe("mlx-community/gemma-2-9b-it");
  });

  it("returns a session DB path", () => {
    const config = loadConfig();
    expect(config.sessionDbPath).toContain("sessions.db");
    expect(config.sessionDbPath).toContain(".2d6mcp");
  });

  it("allows custom SESSION_DB_PATH", () => {
    process.env.SESSION_DB_PATH = "/tmp/my-sessions.db";
    const config = loadConfig();
    expect(config.sessionDbPath).toBe("/tmp/my-sessions.db");
  });
});
