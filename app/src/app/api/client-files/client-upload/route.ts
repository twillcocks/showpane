import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { getClientPortalId } from "@/lib/client-portals";
import { uploadControlPlaneFile } from "@/lib/control-plane";
import { prisma } from "@/lib/db";
import { saveFile, getStoragePath, StorageError } from "@/lib/storage";
import { isRuntimeSnapshotMode } from "@/lib/runtime-state";
import {
  DEFAULT_PORTAL_STORAGE_QUOTA_BYTES,
  isUploadRateLimited,
} from "@/lib/abuse-controls";
import {
  isAllowedUploadFilename,
  isBlockedUploadFilename,
  sanitizeFilename,
  sniffUploadContentType,
} from "@/lib/files";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const portal = await getAuthenticatedPortal(req, "session");
  if (!portal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (isRuntimeSnapshotMode()) {
    const upstream = await uploadControlPlaneFile(portal.slug, file);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: upstream.headers,
    });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
  }

  const portalId = await getClientPortalId(portal.orgId, portal.slug);

  if (!portalId) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  if (isUploadRateLimited(`client:${portal.orgId}:${portal.slug}`)) {
    return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  }

  const filename = sanitizeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const mimeType = sniffUploadContentType(filename, buffer, file.type || undefined);

  if (isBlockedUploadFilename(filename) || !isAllowedUploadFilename(filename)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
  }

  const storagePath = getStoragePath(portal.orgId, portal.slug, filename);

  const [existingFile, portalUsage] = await Promise.all([
    prisma.portalFile.findUnique({
      where: { storagePath },
      select: { size: true },
    }),
    prisma.portalFile.aggregate({
      where: { portalId },
      _sum: { size: true },
    }),
  ]);

  const currentUsage = portalUsage._sum.size ?? 0;
  const existingSize = existingFile?.size ?? 0;
  const projectedUsage = currentUsage - existingSize + file.size;
  if (projectedUsage > DEFAULT_PORTAL_STORAGE_QUOTA_BYTES) {
    return NextResponse.json({ error: "Portal storage quota exceeded" }, { status: 413 });
  }

  try {
    await saveFile(storagePath, buffer, mimeType);
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
    throw err;
  }

  try {
    const record = await prisma.portalFile.upsert({
      where: { storagePath },
      update: { filename, mimeType, checksum, size: file.size, uploadedBy: "client", uploadedAt: new Date() },
      create: { portalId: portalId, filename, mimeType, storagePath, checksum, size: file.size, uploadedBy: "client" },
    });

    console.log(JSON.stringify({ event: "file_upload", slug: portal.slug, filename, size: file.size, uploadedBy: "client" }));

    return NextResponse.json({
      ok: true,
      file: { id: record.id, filename: record.filename, mimeType: record.mimeType, size: record.size, uploadedBy: record.uploadedBy },
    });
  } catch (err) {
    console.error("DB error during file upload:", err);
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}
