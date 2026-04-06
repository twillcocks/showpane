/**
 * Client portal auth helpers.
 *
 * Uses Web Crypto HMAC-SHA256 so it works in both Edge (middleware) and Node
 * (API routes) runtimes.
 */

import { getCredentialVersion } from "@/lib/client-portals";
import { NextRequest, NextResponse } from "next/server";

export const CLIENT_AUTH_COOKIE = "client_auth";
export const CLIENT_AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const CLIENT_SHARE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

type ClientTokenScope = "session" | "share";

type ClientTokenPayload = {
  v: 1;
  slug: string;
  scope: ClientTokenScope;
  exp: number;
  ver: string;
  jti: string;
};

export type VerifiedClientToken = {
  slug: string;
  scope: ClientTokenScope;
};

function getAuthSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

export function isClientAuthConfigured(): boolean {
  return Boolean(getAuthSecret());
}

async function getKey(): Promise<CryptoKey | null> {
  const secret = getAuthSecret();
  if (!secret) return null;

  if (!cachedKey || cachedSecret !== secret) {
    cachedKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    cachedSecret = secret;
  }
  return cachedKey;
}

async function hmacHex(data: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function encodeBase64Url(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + padding);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function parseTokenPayload(value: string): ClientTokenPayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<ClientTokenPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.slug !== "string" ||
      (parsed.scope !== "session" && parsed.scope !== "share") ||
      typeof parsed.exp !== "number" ||
      typeof parsed.ver !== "string" ||
      typeof parsed.jti !== "string"
    ) {
      return null;
    }
    return parsed as ClientTokenPayload;
  } catch {
    return null;
  }
}

async function signClientToken(
  slug: string,
  scope: ClientTokenScope,
  maxAgeSeconds: number
): Promise<string | null> {
  const credentialVersion = await getCredentialVersion(slug);
  if (!credentialVersion) return null;

  const payload: ClientTokenPayload = {
    v: 1,
    slug,
    scope,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    ver: credentialVersion,
    jti: crypto.randomUUID(),
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const sig = await hmacHex(encodedPayload);
  if (!sig) return null;
  return `${encodedPayload}.${sig}`;
}

export async function signSessionToken(slug: string): Promise<string | null> {
  return signClientToken(slug, "session", CLIENT_AUTH_COOKIE_MAX_AGE_SECONDS);
}

export async function signShareToken(slug: string): Promise<string | null> {
  return signClientToken(slug, "share", CLIENT_SHARE_TOKEN_MAX_AGE_SECONDS);
}

export async function verifyClientToken(
  token: string,
  expectedScope?: ClientTokenScope
): Promise<VerifiedClientToken | null> {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encodedPayload = token.substring(0, dotIndex);
  const sig = token.substring(dotIndex + 1);
  const expected = await hmacHex(encodedPayload);
  if (!expected) return null;

  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  const decodedPayload = decodeBase64Url(encodedPayload);
  if (!decodedPayload) return null;

  const payload = parseTokenPayload(decodedPayload);
  if (!payload) return null;

  if (expectedScope && payload.scope !== expectedScope) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  const credentialVersion = await getCredentialVersion(payload.slug);
  if (!credentialVersion || credentialVersion !== payload.ver) return null;

  return { slug: payload.slug, scope: payload.scope };
}

/** Extract authenticated slug from request cookie, or null. */
export async function getAuthenticatedSlug(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(CLIENT_AUTH_COOKIE)?.value;
  if (!token) return null;
  return (await verifyClientToken(token, "session"))?.slug ?? null;
}

/** Set the client auth cookie on a response. */
export function setClientAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(CLIENT_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLIENT_AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}
