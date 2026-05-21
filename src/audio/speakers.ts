// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

export interface SpeakerSegment {
  speaker: string;       // "Speaker 1", "Speaker 2", etc.
  start: number;         // seconds
  end: number;           // seconds
  text: string;          // transcribed text for this speaker turn
}

export interface DiarizedResult {
  text: string;           // full text with inline speaker labels
  segments: SpeakerSegment[];
  speakerCount: number;
}

const SILENCE_GAP_SECONDS = 1.2;
const MIN_SPEAKER_TURN_CHARS = 20;

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

export function detectSpeakers(
  segments: WhisperSegment[],
  gapThresholdSecs: number = SILENCE_GAP_SECONDS
): DiarizedResult {
  if (segments.length === 0) {
    return { text: "", segments: [], speakerCount: 0 };
  }

  if (segments.length === 1) {
    const s = segments[0];
    return {
      text: `[0.0s] Speaker: ${s.text.trim()}`,
      segments: [{ speaker: "Speaker", start: s.start, end: s.end, text: s.text.trim() }],
      speakerCount: 1,
    };
  }

  // Detect speaker changes at segment boundaries with large gaps
  const speakerTurns: WhisperSegment[][] = [];
  let currentTurn: WhisperSegment[] = [segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap >= gapThresholdSecs) {
      speakerTurns.push(currentTurn);
      currentTurn = [segments[i]];
    } else {
      currentTurn.push(segments[i]);
    }
  }
  speakerTurns.push(currentTurn);

  // Deduplicate speaker labels: same interval alternating = same speaker
  // Simple heuristic: alternate between Speaker 1 and Speaker 2
  const result: SpeakerSegment[] = [];
  for (let i = 0; i < speakerTurns.length; i++) {
    const turn = speakerTurns[i];
    const combinedText = turn.map((s) => s.text).join(" ").trim();
    if (combinedText.length < MIN_SPEAKER_TURN_CHARS) continue;

    result.push({
      speaker: (i % 2 === 0) ? "Speaker 1" : "Speaker 2",
      start: turn[0].start,
      end: turn[turn.length - 1].end,
      text: combinedText,
    });
  }

  if (result.length === 0) {
    const combinedText = segments.map((s) => s.text).join(" ").trim();
    return {
      text: `[0.0s] Speaker: ${combinedText}`,
      segments: [{ speaker: "Speaker", start: segments[0].start, end: segments[segments.length - 1].end, text: combinedText }],
      speakerCount: 1,
    };
  }

  const text = result
    .map((s) => `[${s.start.toFixed(1)}s] ${s.speaker}: ${s.text}`)
    .join("\n");

  const uniqueSpeakers = new Set(result.map((s) => s.speaker)).size;

  return { text, segments: result, speakerCount: uniqueSpeakers };
}
