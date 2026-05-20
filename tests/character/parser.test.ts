import { describe, it, expect } from "vitest";
import {
  parseCharacterText,
  readCharacterFile,
  extractUpp,
} from "../../src/character/parser.js";

describe("extractUpp", () => {
  it("extracts a 6-char hex UPP", () => {
    expect(extractUpp("UPP: 7A9C2F")).toBe("7A9C2F");
  });

  it("extracts UPP from inline text", () => {
    expect(extractUpp("Character 777777 is average")).toBe("777777");
  });

  it("returns null when no UPP found", () => {
    expect(extractUpp("No UPP here")).toBeNull();
  });

  it("returns null for 5-char strings", () => {
    expect(extractUpp("ABCDE")).toBeNull();
  });

  it("only matches uppercase hex chars (A-F, 0-9)", () => {
    expect(extractUpp("abcdef")).toBeNull();
    expect(extractUpp("ABCDEF")).toBe("ABCDEF");
  });
});

describe("parseCharacterText", () => {
  it("parses a full character sheet", () => {
    const text = `Name: Jane Doe
Career: Navy
UPP: 7A9C2F
Pilot-3
Engineering-2
Gunnery-1`;

    const result = parseCharacterText(text);
    expect(result.name).toBe("Jane Doe");
    expect(result.career).toBe("Navy");
    expect(result.upp).toBe("7A9C2F");
    expect(result.characteristics.strength).toBe(7);
    expect(result.characteristics.dexterity).toBe(10);
    expect(result.characteristics.endurance).toBe(9);
    expect(result.characteristics.intelligence).toBe(12);
    expect(result.characteristics.education).toBe(2);
    expect(result.characteristics.social).toBe(15);
    expect(result.skills).toHaveLength(3);
    expect(result.skills[0]).toEqual({ name: "Pilot", level: 3 });
    expect(result.skills[1]).toEqual({ name: "Engineering", level: 2 });
    expect(result.skills[2]).toEqual({ name: "Gunnery", level: 1 });
  });

  it("handles colon-separated skills", () => {
    const text = `Name: Test
Pilot: 3
Navigation: 2`;
    const result = parseCharacterText(text);
    expect(result.skills).toHaveLength(2);
    expect(result.skills[0]).toEqual({ name: "Pilot", level: 3 });
  });

  it("handles dash-separated skills", () => {
    const text = `Name: Test
Pilot - 3
Nav - 1`;
    const result = parseCharacterText(text);
    expect(result.skills).toHaveLength(2);
  });

  it("defaults UPP to ?????? when missing", () => {
    const result = parseCharacterText("Name: NoStats\nSkill-1");
    expect(result.upp).toBe("??????");
    expect(result.characteristics).toEqual({});
  });

  it("infers career from line with UPP", () => {
    const result = parseCharacterText("Marine 777777");
    expect(result.upp).toBe("777777");
    expect(result.career).toBe("Marine");
  });

  it("handles case-insensitive labels", () => {
    const text = `name: Test
CAREER: Army
upp: 555555`;
    const result = parseCharacterText(text);
    expect(result.name).toBe("Test");
    expect(result.career).toBe("Army");
    expect(result.upp).toBe("555555");
  });

  it("preserves raw text", () => {
    const text = "Name: Test\nSkill-1";
    const result = parseCharacterText(text);
    expect(result.raw).toBe(text);
  });
});

describe("readCharacterFile", () => {
  it("uses filename (without extension) as fallback name", () => {
    const result = readCharacterFile("Skill-1\nSkill-2", "/path/to/MyCharacter.txt");
    expect(result.name).toBe("MyCharacter");
  });

  it("does not override explicit name", () => {
    const result = readCharacterFile("Name: Explicit\nSkill-1", "/path/to/file.txt");
    expect(result.name).toBe("Explicit");
  });

  it("handles backslash paths", () => {
    const result = readCharacterFile("Skill-1", "C:\\Users\\test\\chars\\Hero.txt");
    expect(result.name).toBe("Hero");
  });
});
