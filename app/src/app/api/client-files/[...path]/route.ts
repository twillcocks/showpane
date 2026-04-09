import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { downloadControlPlaneFile } from "@/lib/control-plane";
import { readFile_, StorageError } from "@/lib/storage";
import { prisma } from "@/lib/db";
import { getServedFileMetadata, hasSafePathSegments } from "@/lib/files";
import { getStoragePath } from "@/lib/storage";
import { isRuntimeSnapshotMode } from "@/lib/runtime-state";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const portal = await getAuthenticatedPortal(req);
  if (!portal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  if (!hasSafePathSegments(pathSegments) || pathSegments.length !== 1) {
    return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
  }

  if (isRuntimeSnapshotMode()) {
    const res = await downloadControlPlaneFile(portal.slug, pathSegments);
    if (!res.ok) {
      return NextResponse.json({ error: "File not found" }, { status: res.status });
    }
    return new NextResponse(res.body, {
      status: res.status,
      headers: res.headers,
    });
  }

  const filename = pathSegments[0];
  const filePath = getStoragePath(portal.orgId, portal.slug, filename);

  try {
    const record = await prisma.portalFile.findFirst({
      where: {
        storagePath: filePath,
        portal: {
          organizationId: portal.orgId,
          slug: portal.slug,
          isActive: true,
        },
      },
      select: {
        filename: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!record) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const data = await readFile_(record.storagePath);
    if (!data) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const served = getServedFileMetadata(record.filename, record.mimeType);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": served.contentType,
        "Content-Disposition": `${served.disposition}; filename="${record.filename}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
    throw err;
  }
}
