import { NextRequest, NextResponse } from "next/server";
import { verifyClientToken, setClientAuthCookie, signSessionToken } from "@/lib/client-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; token: string }> }
) {
  const { slug, token } = await params;

  const verified = await verifyClientToken(token, "share");
  if (!verified || verified.slug !== slug) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  // Mint a session token so the user stays logged in
  const sessionToken = await signSessionToken(verified.orgId, slug);
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/client", req.url));
  }

  const res = NextResponse.redirect(new URL(`/client/${slug}`, req.url));
  setClientAuthCookie(res, sessionToken);
  return res;
}
