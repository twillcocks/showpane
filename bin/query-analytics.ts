import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: query-analytics [--slug <slug>] [--days <n>] --org-id <orgId>");
    console.log("Queries portal events. Omit --slug for all portals. Default --days is 30.");
    process.exit(0);
  }

  const slug = getArg(args, "--slug");
  const days = parseInt(getArg(args, "--days") ?? "30", 10);
  const orgId = getArg(args, "--org-id");

  if (!orgId) fail("Missing --org-id");

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const prisma = new PrismaClient();

  try {
    // Find portals in scope
    const portals = await prisma.clientPortal.findMany({
      where: {
        organizationId: orgId,
        ...(slug ? { slug } : {}),
      },
      select: { id: true, slug: true },
    });

    if (slug && portals.length === 0) fail(`Portal "${slug}" not found`);

    const portalIds = portals.map((p) => p.id);

    // Query events grouped by type
    const events = await prisma.portalEvent.groupBy({
      by: ["event", "portalId"],
      where: {
        portalId: { in: portalIds },
        createdAt: { gte: since },
      },
      _count: { id: true },
    });

    // Get last activity
    const lastEvent = await prisma.portalEvent.findFirst({
      where: {
        portalId: { in: portalIds },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Aggregate counts by event type
    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.event] = (counts[e.event] ?? 0) + e._count.id;
    }

    console.log(JSON.stringify({
      ok: true,
      slug: slug ?? "all",
      period: `${days}d`,
      views: counts["portal_view"] ?? 0,
      tabSwitches: counts["tab_switch"] ?? 0,
      events: counts,
      lastActivity: lastEvent?.createdAt.toISOString() ?? null,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
