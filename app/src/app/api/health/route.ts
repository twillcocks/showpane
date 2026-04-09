import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRuntimeSnapshotMode } from "@/lib/runtime-state";

export async function GET() {
  if (isRuntimeSnapshotMode()) {
    return NextResponse.json({ status: "ok", mode: "runtime-snapshot" });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch {
    return NextResponse.json(
      { status: "error", db: "disconnected" },
      { status: 503 }
    );
  }
}
