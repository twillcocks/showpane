import { NextRequest, NextResponse } from "next/server";
import {
  CLIENT_SHARE_TOKEN_MAX_AGE_SECONDS,
  setClientAuthCookie,
  verifyClientToken,
} from "@/lib/client-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;

  const verified = await verifyClientToken(token, "share");
  if (!verified || verified.slug !== slug) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  const res = NextResponse.redirect(new URL(`/client/${slug}`, req.url));
  setClientAuthCookie(res, token, CLIENT_SHARE_TOKEN_MAX_AGE_SECONDS);
  return res;
}
