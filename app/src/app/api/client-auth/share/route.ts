import { NextRequest, NextResponse } from "next/server";
import {
  getAuthenticatedSlug,
  isClientAuthConfigured,
  signShareToken,
} from "@/lib/client-auth";

export async function GET(req: NextRequest) {
  if (!isClientAuthConfigured()) {
    return NextResponse.json(
      { error: "Client portal auth is not configured." },
      { status: 503 }
    );
  }

  const slug = await getAuthenticatedSlug(req);
  if (!slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shareToken = await signShareToken(slug);
  if (!shareToken) {
    return NextResponse.json({ error: "Unable to create share link" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const shareUrl = `${baseUrl}/client/${slug}/s/${shareToken}`;

  return NextResponse.json({ shareUrl });
}
