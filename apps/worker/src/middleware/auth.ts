// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 Jupiter Industries (Liam Crowter) and the 2d6mcp maintainers

import nacl from "tweetnacl";
import { signPayload, verifyToken } from "./jwt.js";
import type { Env } from "../env.js";
import type { JwtPayload } from "../types.js";
import { getGuild } from "../db/queries.js";

export { signPayload, verifyToken };

export async function verifyGuildAccess(env: Env, jwtPayload: JwtPayload, guildId: string): Promise<boolean> {
  if (jwtPayload.guilds.includes(guildId)) return true;
  const guild = await getGuild(env.DB, guildId);
  return guild !== null && guild.owner_id === jwtPayload.sub;
}

export function verifyDiscordSignature(body: string, signature: string, timestamp: string, publicKey: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexToUint8Array(signature),
      hexToUint8Array(publicKey),
    );
  } catch {
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
