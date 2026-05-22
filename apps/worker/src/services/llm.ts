// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export interface LlmOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResult {
  response: string;
  model: string;
}

const PRIMARY_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const FALLBACK_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export function getActiveModel(): string {
  return PRIMARY_MODEL;
}

export async function generateChat(ai: Ai, options: LlmOptions): Promise<LlmResult> {
  try {
    const result = await ai.run(PRIMARY_MODEL, {
      messages: options.messages,
      max_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.3,
    }) as { response?: string; choices?: Array<{ message: { content: string } }> };

    const response = result.response || result.choices?.[0]?.message?.content || "";
    return { response, model: PRIMARY_MODEL };
  } catch (err) {
    // Fallback to Llama 3.2 3B if Qwen fails
    const result = await ai.run(FALLBACK_MODEL, {
      messages: options.messages,
      max_tokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.3,
    }) as { response?: string; choices?: Array<{ message: { content: string } }> };

    const response = result.response || result.choices?.[0]?.message?.content || "";
    return { response, model: `${FALLBACK_MODEL} (fallback)` };
  }
}

export async function warmupModel(ai: Ai): Promise<void> {
  try {
    await ai.run(PRIMARY_MODEL, {
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
  } catch {
    // warm-up failure is non-critical
  }
}
