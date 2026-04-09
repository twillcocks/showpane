import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { listControlPlaneFiles } from "@/lib/control-plane";
import { prisma } from "@/lib/db";
import { isRuntimeSnapshotMode } from "@/lib/runtime-state";

export async function GET(req: NextRequest) {
  const portal = await getAuthenticatedPortal(req);
  if (!portal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (isRuntimeSnapshotMode()) {
      const files = await listControlPlaneFiles(portal.slug);
      return NextResponse.json({ files });
    }

    const files = await prisma.portalFile.findMany({
      where: { portal: { organizationId: portal.orgId, slug: portal.slug, isActive: true } },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        uploadedBy: true,
        uploadedAt: true,
      },
    });

    return NextResponse.json({ files });
  } catch (err) {
    console.error("DB error listing files:", err);
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}
