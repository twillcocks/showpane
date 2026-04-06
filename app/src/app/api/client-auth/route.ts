import { NextRequest, NextResponse } from "next/server";
import { validateClientLogin } from "@/lib/client-portals";
import {
  isClientAuthConfigured,
  signSessionToken,
  setClientAuthCookie,
} from "@/lib/client-auth";

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    if (attempts.size > 1000) {
      for (const [key, e] of attempts) {
        if (now > e.resetAt) attempts.delete(key);
      }
    }
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  if (!isClientAuthConfigured()) {
    return NextResponse.json(
      { error: "Client portal auth is not configured." },
      { status: 503 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { username, password } = body;
  if (!username || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const slug = await validateClientLogin(username, password);
  if (!slug) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signSessionToken(slug);
  if (!token) {
    return NextResponse.json({ error: "Unable to create session" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, slug });
  setClientAuthCookie(res, token);
  return res;
}
