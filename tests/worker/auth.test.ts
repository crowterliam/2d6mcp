// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import { describe, it, expect } from "vitest";
import nacl from "tweetnacl";
import { verifyDiscordSignature } from "../../apps/worker/src/middleware/auth.js";

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSignature(body: string, timestamp: string, publicKey: Uint8Array, secretKey: Uint8Array): string {
  const message = new TextEncoder().encode(timestamp + body);
  const sig = nacl.sign.detached(message, secretKey);
  return hexEncode(sig);
}

describe("Discord Ed25519 signature verification", () => {
  const keypair = nacl.sign.keyPair();
  const publicKeyHex = hexEncode(keypair.publicKey);
  const secretKey = keypair.secretKey;

  it("verifies a valid signature", () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigHex = generateSignature(body, timestamp, keypair.publicKey, secretKey);

    const result = verifyDiscordSignature(body, sigHex, timestamp, publicKeyHex);
    expect(result).toBe(true);
  });

  it("rejects tampered body", () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigHex = generateSignature(body, timestamp, keypair.publicKey, secretKey);

    const tamperedBody = JSON.stringify({ type: 2 });
    const result = verifyDiscordSignature(tamperedBody, sigHex, timestamp, publicKeyHex);
    expect(result).toBe(false);
  });

  it("rejects wrong timestamp", () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp1 = "1000000";
    const sigHex = generateSignature(body, timestamp1, keypair.publicKey, secretKey);

    const result = verifyDiscordSignature(body, sigHex, "9999999", publicKeyHex);
    expect(result).toBe(false);
  });

  it("rejects wrong public key", () => {
    const otherKeypair = nacl.sign.keyPair();
    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigHex = generateSignature(body, timestamp, keypair.publicKey, secretKey);

    const result = verifyDiscordSignature(body, sigHex, timestamp, hexEncode(otherKeypair.publicKey));
    expect(result).toBe(false);
  });

  it("rejects invalid hex signature", () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // Invalid hex
    expect(verifyDiscordSignature(body, "not-hex", timestamp, publicKeyHex)).toBe(false);
    // Wrong length
    expect(verifyDiscordSignature(body, "ab", timestamp, publicKeyHex)).toBe(false);
    // Empty
    expect(verifyDiscordSignature(body, "", timestamp, publicKeyHex)).toBe(false);
  });

  it("handles Discord ping payload", () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigHex = generateSignature(body, timestamp, keypair.publicKey, secretKey);

    expect(verifyDiscordSignature(body, sigHex, timestamp, publicKeyHex)).toBe(true);
  });

  it("handles Discord interaction payload", () => {
    const interaction = {
      type: 2,
      token: "test-token",
      id: "123",
      application_id: "456",
      guild_id: "789",
      data: { name: "ask", options: [{ name: "question", value: "test?" }] },
    };
    const body = JSON.stringify(interaction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sigHex = generateSignature(body, timestamp, keypair.publicKey, secretKey);

    expect(verifyDiscordSignature(body, sigHex, timestamp, publicKeyHex)).toBe(true);
  });
});
