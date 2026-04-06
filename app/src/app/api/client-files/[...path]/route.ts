import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSlug } from "@/lib/client-auth";
import { readFile_, StorageError } from "@/lib/storage";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const slug = await getAuthenticatedSlug(req);
  if (!slug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: pathSegments } = await params;
  const filePath = `portals/${slug}/${pathSegments.join("/")}`;

  try {
    const data = await readFile_(filePath);
    if (!data) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const filename = pathSegments[pathSegments.length - 1] || "file";

    // Try DB lookup for accurate mimeType, fall back to extension
    let contentType: string;
    try {
      const record = await prisma.portalFile.findFirst({
        where: { storagePath: filePath },
        select: { mimeType: true },
      });
      contentType = record?.mimeType || guessContentType(filename);
    } catch {
      contentType = guessContentType(filename);
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof StorageError) {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
    throw err;
  }
}

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "txt") return "text/plain";
  return "application/octet-stream";
}
