import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveFile, getStoragePath, StorageError } from "@/lib/storage";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 255);
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.AUTH_SECRET;
  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const portalSlug = formData.get("portalSlug") as string | null;

  if (!file || !portalSlug) {
    return NextResponse.json({ error: "Missing file or portalSlug" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 413 });
  }

  const portal = await prisma.clientPortal.findFirst({
    where: { slug: portalSlug, isActive: true },
    select: { id: true },
  });

  if (!portal) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const filename = sanitizeFilename(file.name);
  const storagePath = getStoragePath(portalSlug, filename);
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
      update: { filename, mimeType, size: file.size, uploadedBy: "operator", uploadedAt: new Date() },
      create: { portalId: portal.id, filename, mimeType, storagePath, size: file.size, uploadedBy: "operator" },
    });

    console.log(JSON.stringify({ event: "file_upload", slug: portalSlug, filename, size: file.size, uploadedBy: "operator" }));

    return NextResponse.json({
      ok: true,
      file: { id: record.id, filename: record.filename, mimeType: record.mimeType, size: record.size, uploadedBy: record.uploadedBy },
    });
  } catch (err) {
    console.error("DB error during file upload:", err);
    return NextResponse.json({ error: "Database error" }, { status: 503 });
  }
}
