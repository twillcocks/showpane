import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSlug } from "@/lib/client-auth";
import { prisma } from "@/lib/db";

const VALID_EVENTS = new Set(["portal_view", "tab_switch"]);

export async function POST(req: NextRequest) {
  const slug = await getAuthenticatedSlug(req);
  if (!slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, detail } = body as { event?: string; detail?: string };

  if (!event || !VALID_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Look up portal by slug to get its ID
  const portal = await prisma.clientPortal.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });

  if (portal) {
    await prisma.portalEvent.create({
      data: {
        portalId: portal.id,
        event,
        detail: detail || null,
        ipAddress: ip,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
