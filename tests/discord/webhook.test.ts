import { describe, it, expect } from "vitest";
import {
  colorFromName,
  type DiscordMessage,
} from "../../packages/server/src/discord/webhook.js";

describe("colorFromName", () => {
  it("resolves named colors", () => {
    expect(colorFromName("red")).toBe(0xff0000);
    expect(colorFromName("green")).toBe(0x00ff00);
    expect(colorFromName("blue")).toBe(0x0000ff);
    expect(colorFromName("gold")).toBe(0xffd700);
    expect(colorFromName("teal")).toBe(0x008080);
  });

  it("handles case-insensitive names", () => {
    expect(colorFromName("RED")).toBe(0xff0000);
    expect(colorFromName("Gold")).toBe(0xffd700);
  });

  it("parses hex strings", () => {
    expect(colorFromName("#ff0000")).toBe(0xff0000);
    expect(colorFromName("#00ff00")).toBe(0x00ff00);
  });

  it("returns default for unknown names", () => {
    expect(colorFromName("unknown")).toBe(0x2d6);
  });

  it("handles all known color names", () => {
    const names = [
      "red", "green", "blue", "yellow", "purple", "orange", "cyan",
      "white", "black", "gold", "silver", "crimson", "darkred",
      "darkgreen", "darkblue", "teal", "magenta", "lime", "navy",
    ];
    for (const name of names) {
      const color = colorFromName(name);
      expect(typeof color).toBe("number");
      expect(color).toBeGreaterThan(0);
    }
  });
});
