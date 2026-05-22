// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers
//
// Minimal JWT implementation for Cloudflare Workers.
// Uses Web Crypto API (SubtleCrypto) — no external deps, no node:crypto.

interface JwtHeader {
  alg: string;
  typ: string;
}

function base64UrlEncode(buffer: Uint8Array): string {
  const str = btoa(String.fromCharCode(...buffer));
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const keyData = utf8ToBytes(secret);
  return crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign", "verify"],
  );
}

export async function signPayload(payload: Record<string, unknown>, secret: string, expiresIn: string = "15m"): Promise<string> {
  const header = JSON.stringify({ alg: "HS256", typ: "JWT" });

  const now = Math.floor(Date.now() / 1000);
  let exp = now + 900;
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const val = parseInt(match[1], 10);
    const unit = match[2];
    exp = now + val * (unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400);
  }

  const fullPayload = JSON.stringify({ ...payload, iat: now, exp });

  const headerEncoded = base64UrlEncode(utf8ToBytes(header));
  const payloadEncoded = base64UrlEncode(utf8ToBytes(fullPayload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await getCryptoKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, utf8ToBytes(signingInput));
  const signature = base64UrlEncode(new Uint8Array(sig));

  return `${signingInput}.${signature}`;
}

export async function verifyToken<T extends Record<string, unknown> = Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await getCryptoKey(secret);
  const sigBytes = base64UrlDecode(signatureEncoded);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, utf8ToBytes(signingInput));

  if (!valid) return null;

  const payloadBytes = base64UrlDecode(payloadEncoded);
  const payload = JSON.parse(bytesToUtf8(payloadBytes)) as T & { exp: number };

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}
