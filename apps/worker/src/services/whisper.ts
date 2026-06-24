// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export async function transcribeWithWhisper(ai: Ai, audioData: number[]): Promise<string> {
  const result = await ai.run("@cf/openai/whisper-large-v3-turbo", {
    audio: audioData,
  } as unknown as Ai_Cf_Openai_Whisper_Large_V3_Turbo_Input);

  return result.text || "";
}
