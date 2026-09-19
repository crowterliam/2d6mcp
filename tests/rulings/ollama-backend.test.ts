/// SPDX-License-Identifier: AGPL-3.0-only
/// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "node:child_process";
import {
  isOllamaAvailable,
  synthesizeWithOllama,
  normalizeOllamaHost,
  DEFAULT_OLLAMA_HOST,
  DEFAULT_OLLAMA_MODEL,
} from "../../packages/server/src/rulings/backends/ollama.js";
import {
  synthesizeRuling,
  isMLXLLMAvailable,
  isLLMAvailable,
  resolveEffectiveLlmBackend,
  resetOllamaFallbackLogForTests,
} from "../../packages/server/src/rulings/mlx-synthesize.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execSync: vi.fn(actual.execSync),
  };
});

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.LLM_BACKEND;
  delete process.env.OLLAMA_MODEL;
  delete process.env.OLLAMA_HOST;
  resetOllamaFallbackLogForTests();
  vi.mocked(execSync).mockReset();
  vi.mocked(execSync).mockImplementation(() => {
    throw new Error("mlx_lm.generate not found");
  });
});

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  vi.mocked(execSync).mockReset();
});

describe("normalizeOllamaHost", () => {
  it("defaults and strips trailing slashes", () => {
    expect(normalizeOllamaHost("")).toBe(DEFAULT_OLLAMA_HOST);
    expect(normalizeOllamaHost("http://127.0.0.1:11434/")).toBe("http://127.0.0.1:11434");
    expect(normalizeOllamaHost("127.0.0.1:11434")).toBe("http://127.0.0.1:11434");
  });
});

describe("isOllamaAvailable", () => {
  it("returns true when /api/tags answers 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ models: [{ name: DEFAULT_OLLAMA_MODEL }] }));
    await expect(isOllamaAvailable()).resolves.toBe(true);
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe(`${DEFAULT_OLLAMA_HOST}/api/tags`);
  });

  it("returns false when the daemon is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(isOllamaAvailable()).resolves.toBe(false);
  });
});

describe("synthesizeWithOllama", () => {
  it("posts /api/generate with stream disabled and returns the model text", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      model: "llama3.2:3b",
      response: "[OGL Skill: Broker] Average is TN 8.",
      prompt_eval_count: 12,
      eval_count: 8,
      total_duration: 1_500_000_000,
    }));

    const result = await synthesizeWithOllama("average broker check", {
      system: "You are a rules assistant.",
      model: "llama3.2:3b",
    });

    expect(result.response).toContain("Average is TN 8");
    expect(result.model).toBe("llama3.2:3b");
    expect(result.promptTokens).toBe(12);
    expect(result.completionTokens).toBe(8);
    expect(result.durationSeconds).toBe(1.5);

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe(`${DEFAULT_OLLAMA_HOST}/api/generate`);
    const body = JSON.parse(String((init as RequestInit).body)) as {
      model: string;
      stream: boolean;
      system: string;
      prompt: string;
    };
    expect(body.model).toBe("llama3.2:3b");
    expect(body.stream).toBe(false);
    expect(body.system).toContain("rules assistant");
    expect(body.prompt).toContain("average broker check");
  });
});

describe("LLM_BACKEND=ollama dispatch", () => {
  it("isMLXLLMAvailable is true without probing mlx_lm.generate", () => {
    process.env.LLM_BACKEND = "ollama";
    expect(isMLXLLMAvailable()).toBe(true);
  });

  it("synthesizeRuling uses ollama HTTP and does not spawn mlx_lm.generate", async () => {
    process.env.LLM_BACKEND = "ollama";
    process.env.OLLAMA_MODEL = "qwen2.5:7b";
    process.env.OLLAMA_HOST = "http://127.0.0.1:11434";

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      model: "qwen2.5:7b",
      response: "[OGL] Freight lots use population and starport.",
      prompt_eval_count: 20,
      eval_count: 10,
    }));

    const result = await synthesizeRuling("average broker freight", "Broker is a skill.", { qualityFilter: false });
    expect(result.model).toBe("qwen2.5:7b");
    expect(result.response).toContain("Freight lots");
    expect(vi.mocked(globalThis.fetch).mock.calls[0][0]).toBe("http://127.0.0.1:11434/api/generate");
  });
});

describe("win32 ollama auto-fallback", () => {
  it("resolves ollama when mlx is missing and /api/tags answers", async () => {
    process.env.LLM_BACKEND = "mlx";
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ models: [] }));

    await expect(resolveEffectiveLlmBackend("win32")).resolves.toBe("ollama");
    await expect(isLLMAvailable("win32")).resolves.toBe(true);
  });

  it("does not auto-fallback on linux", async () => {
    process.env.LLM_BACKEND = "mlx";
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ models: [] }));

    await expect(resolveEffectiveLlmBackend("linux")).resolves.toBe("mlx");
  });
});
