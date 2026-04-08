import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedPortal } from "@/lib/client-auth";
import { prisma } from "@/lib/db";
import { saveFile, getStoragePath, StorageError } from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

export async function POST(req: NextRequest) {
  const portal = await getAuthenticatedPortal(req);
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

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
  }

  const portalRecord = await prisma.clientPortal.findFirst({
    where: { organizationId: portal.orgId, slug: portal.slug, isActive: true },
    select: { id: true },
  });

  if (!portalRecord) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const filename = sanitizeFilename(file.name);
  const storagePath = getStoragePath(portal.slug, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";

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
      update: { filename, mimeType, size: file.size, uploadedBy: "client", uploadedAt: new Date() },
      create: { portalId: portalRecord.id, filename, mimeType, storagePath, size: file.size, uploadedBy: "client" },
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
