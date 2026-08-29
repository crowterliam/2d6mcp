import { describe, it, expect, afterEach } from "vitest";
import { statSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { createPrivatePromptFile } from "../../packages/server/src/rulings/backends/llamacpp.js";

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe("createPrivatePromptFile", () => {
  it("creates an exclusive 0600 file in a 0700 directory", () => {
    const file = createPrivatePromptFile("secret ruling prompt");
    cleanups.push(file.cleanup);

    const fileStat = statSync(file.path);
    const dirStat = statSync(dirname(file.path));

    expect(fileStat.isFile()).toBe(true);
    if (process.platform !== "win32") {
      expect(fileStat.mode & 0o777).toBe(0o600);
      expect(dirStat.mode & 0o777).toBe(0o700);
    }
    expect(file.path).not.toMatch(/2d6mcp-llama-prompt-\d+\.txt$/);
  });

  it("cleanup removes the directory", () => {
    const file = createPrivatePromptFile("ephemeral");
    const dir = dirname(file.path);
    file.cleanup();
    expect(existsSync(file.path)).toBe(false);
    expect(existsSync(dir)).toBe(false);
  });
});
