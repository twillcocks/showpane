import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { getClientPortalId } from "@/lib/client-portals";
import { sendControlPlaneEvent } from "@/lib/control-plane";
import {
  EVENT_METADATA_MAX_BYTES,
  isEventRateLimited,
} from "@/lib/abuse-controls";
import { prisma } from "@/lib/db";
import {
  isPortalEventType,
  PORTAL_EVENT_TYPES,
  type PortalEventMetadata,
} from "@/lib/portal-contracts";
import { isRuntimeSnapshotMode } from "@/lib/runtime-state";

const VALID_EVENTS = new Set(PORTAL_EVENT_TYPES);

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
    metadata?: PortalEventMetadata;
  };

  if (!event || !isPortalEventType(event) || !VALID_EVENTS.has(event)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  if (isEventRateLimited(`${portal.orgId}:${portal.slug}:${visitorId || "anon"}`)) {
    return NextResponse.json({ error: "Too many events. Try again later." }, { status: 429 });
  }

  const metadataText = metadata ? JSON.stringify(metadata) : null;
  if (metadataText && Buffer.byteLength(metadataText, "utf8") > EVENT_METADATA_MAX_BYTES) {
    return NextResponse.json({ error: "Event metadata too large" }, { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRuntimeSnapshotMode()) {
    try {
      await sendControlPlaneEvent(portal.slug, {
        event,
        detail,
        visitorId,
        metadata,
      });
    } catch {
      // Do not fail portal interactions if analytics forwarding is unavailable.
    }
  } else {
    // Look up portal by org-scoped slug to get its ID
    const portalId = await getClientPortalId(portal.orgId, portal.slug);

    if (portalId) {
      await prisma.portalEvent.create({
        data: {
          portalId,
          event,
          detail: detail || null,
          visitorId: visitorId || null,
          metadata: metadataText,
          ipAddress: ip,
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
