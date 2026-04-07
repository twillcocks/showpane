/**
 * Pure HMAC-SHA256 token signing and verification.
 *
 * No Next.js imports. No database calls. Works in Edge, Node, and tsx scripts.
 * Uses Web Crypto (crypto.subtle) which is available in Node 20+.
 *
 * client-auth.ts wraps these with DB lookups and Next.js request/response helpers.
 * bin/ scripts import these directly for CLI token operations.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

export type ClientTokenScope = "session" | "share";

export type ClientTokenPayload = {
  v: 1;
  slug: string;
  scope: ClientTokenScope;
  exp: number;
  ver: string;
  jti: string;
};

export type VerifiedTokenPayload = {
  slug: string;
  scope: ClientTokenScope;
  ver: string;
};

export function getAuthSecret(): string | null {
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

/**
 * Sign a token payload. Pure crypto, no DB.
 * Caller provides the full payload including credentialVersion.
 */
export async function signTokenPayload(
  payload: ClientTokenPayload
): Promise<string | null> {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const sig = await hmacHex(encodedPayload);
  if (!sig) return null;
  return `${encodedPayload}.${sig}`;
}

/**
 * Build and sign a token. Pure crypto, no DB.
 * Caller must provide slug, scope, maxAge, and credentialVersion.
 */
export async function buildAndSignToken(
  slug: string,
  scope: ClientTokenScope,
  maxAgeSeconds: number,
  credentialVersion: string
): Promise<string | null> {
  const payload: ClientTokenPayload = {
    v: 1,
    slug,
    scope,
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    ver: credentialVersion,
    jti: crypto.randomUUID(),
  };
  return signTokenPayload(payload);
}

/**
 * Verify token signature and decode payload. Pure crypto, no DB.
 * Does NOT check credential version against DB. Caller must do that.
 * Returns the payload if signature is valid and token is not expired.
 */
export async function verifyTokenSignature(
  token: string,
  expectedScope?: ClientTokenScope
): Promise<VerifiedTokenPayload | null> {
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;

  const encodedPayload = token.substring(0, dotIndex);
  const sig = token.substring(dotIndex + 1);
  const expected = await hmacHex(encodedPayload);
  if (!expected) return null;

  // Constant-time comparison
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

  return { slug: payload.slug, scope: payload.scope, ver: payload.ver };
}

/** Max age constants */
export const SESSION_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const SHARE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours
