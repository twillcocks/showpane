import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { prisma } from "@/lib/db";

const VALID_EVENTS = new Set([
  "portal_view",
  "tab_switch",
  "section_view",
  "section_time",
  "file_download",
  "share_link_access",
]);

export async function POST(req: NextRequest) {
  const portal = await getAuthenticatedPortal(req);
  if (!portal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, detail, visitorId, metadata } = body as {
    event?: string;
    detail?: string;
    visitorId?: string;
    metadata?: Record<string, unknown>;
  };

  if (!event || !VALID_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // Look up portal by org-scoped slug to get its ID
  const portalRecord = await prisma.clientPortal.findFirst({
    where: { organizationId: portal.orgId, slug: portal.slug, isActive: true },
    select: { id: true },
  });

  if (portalRecord) {
    await prisma.portalEvent.create({
      data: {
        portalId: portalRecord.id,
        event,
        detail: detail || null,
        visitorId: visitorId || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress: ip,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
