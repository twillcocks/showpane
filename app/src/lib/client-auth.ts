/**
 * Client portal auth helpers.
 *
 * Wraps token.ts (pure crypto) with DB lookups and Next.js request/response helpers.
 * For CLI scripts that need token operations without Next.js, import from token.ts directly.
 */

import { getCredentialVersion } from "@/lib/client-portals";
import { NextRequest, NextResponse } from "next/server";
import {
  buildAndSignToken,
  verifyTokenSignature,
  isClientAuthConfigured,
  SESSION_TOKEN_MAX_AGE_SECONDS,
  SHARE_TOKEN_MAX_AGE_SECONDS,
  type VerifiedTokenPayload,
} from "@/lib/token";

export { isClientAuthConfigured } from "@/lib/token";
export type { ClientTokenScope, VerifiedTokenPayload } from "@/lib/token";

export const CLIENT_AUTH_COOKIE = "client_auth";
export const CLIENT_AUTH_COOKIE_MAX_AGE_SECONDS = SESSION_TOKEN_MAX_AGE_SECONDS;
export const CLIENT_SHARE_TOKEN_MAX_AGE_SECONDS = SHARE_TOKEN_MAX_AGE_SECONDS;

export type VerifiedClientToken = {
  slug: string;
  scope: "session" | "share";
};

async function signClientToken(
  slug: string,
  scope: "session" | "share",
  maxAgeSeconds: number
): Promise<string | null> {
  const credentialVersion = await getCredentialVersion(slug);
  if (!credentialVersion) return null;
  return buildAndSignToken(slug, scope, maxAgeSeconds, credentialVersion);
}

export async function signSessionToken(slug: string): Promise<string | null> {
  return signClientToken(slug, "session", SESSION_TOKEN_MAX_AGE_SECONDS);
}

export async function signShareToken(slug: string): Promise<string | null> {
  return signClientToken(slug, "share", SHARE_TOKEN_MAX_AGE_SECONDS);
}

export async function verifyClientToken(
  token: string,
  expectedScope?: "session" | "share"
): Promise<VerifiedClientToken | null> {
  const payload = await verifyTokenSignature(token, expectedScope);
  if (!payload) return null;

  // Check credential version against DB
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
