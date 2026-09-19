// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Ollama HTTP backend — local daemon, no GGUF download required.
// POST /api/generate  GET /api/tags

export const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";

const TAGS_TIMEOUT_MS = 2000;
const GENERATE_TIMEOUT_MS = 120000;

export interface OllamaSynthesizeResult {
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  durationSeconds: number;
}

export interface OllamaSynthesizeOptions {
  model?: string;
  host?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  system?: string;
}

export function normalizeOllamaHost(host: string | undefined): string {
  const trimmed = (host ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_OLLAMA_HOST;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function ollamaUrl(host: string, path: string): string {
  return `${normalizeOllamaHost(host)}${path}`;
}

async function fetchOllama(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const fetchFn = globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error(`${label} failed: fetch is not available in this Node runtime`);
  }
  try {
    return await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs / 1000}s`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${label} failed: ${message}`);
  }
}

export async function isOllamaAvailable(host: string = DEFAULT_OLLAMA_HOST): Promise<boolean> {
  try {
    const response = await fetchOllama(
      ollamaUrl(host, "/api/tags"),
      { method: "GET" },
      TAGS_TIMEOUT_MS,
      "ollama /api/tags"
    );
    return response.ok;
  } catch {
    return false;
  }
}

interface OllamaGenerateResponse {
  model?: string;
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
}

export async function synthesizeWithOllama(
  prompt: string,
  options: OllamaSynthesizeOptions = {}
): Promise<OllamaSynthesizeResult> {
  const host = normalizeOllamaHost(options.host);
  const model = options.model?.trim() || DEFAULT_OLLAMA_MODEL;
  const maxTokens = options.maxTokens || 512;
  const temperature = options.temperature ?? 0.3;
  const topP = options.topP ?? 0.9;
  const topK = options.topK ?? 40;

  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    options: {
      temperature,
      top_p: topP,
      top_k: topK,
      num_predict: maxTokens,
    },
  };
  if (options.system) {
    body.system = options.system;
  }

  const startTime = Date.now();
  const response = await fetchOllama(
    ollamaUrl(host, "/api/generate"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    GENERATE_TIMEOUT_MS,
    "ollama /api/generate"
  );

  const rawText = await response.text();
  let parsed: OllamaGenerateResponse;
  try {
    parsed = JSON.parse(rawText) as OllamaGenerateResponse;
  } catch {
    throw new Error(
      `ollama /api/generate returned non-JSON (${response.status}): ${rawText.slice(-200) || "empty body"}`
    );
  }

  if (!response.ok || parsed.error) {
    throw new Error(
      `ollama /api/generate failed (${response.status}): ${parsed.error || rawText.slice(-200) || "unknown error"}`
    );
  }

  const generated = (parsed.response ?? "").trim();
  if (!generated) {
    throw new Error("ollama /api/generate returned an empty response");
  }

  const durationFromApi =
    typeof parsed.total_duration === "number" && parsed.total_duration > 0
      ? parsed.total_duration / 1e9
      : (Date.now() - startTime) / 1000;

  return {
    response: generated,
    model: parsed.model || model,
    promptTokens: parsed.prompt_eval_count ?? Math.ceil(((options.system?.length ?? 0) + prompt.length) / 4),
    completionTokens: parsed.eval_count ?? Math.ceil(generated.length / 4),
    durationSeconds: Math.round(durationFromApi * 100) / 100,
  };
}
