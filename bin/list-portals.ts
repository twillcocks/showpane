import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: list-portals [--org-id <orgId>]");
    console.log("Lists all client portals. Defaults to first organization if --org-id omitted.");
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
    let orgId = getArg("--org-id");

    if (!orgId) {
      const firstOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (!firstOrg) fail("No organizations found");
      orgId = firstOrg.id;
    }

    const portals = await prisma.clientPortal.findMany({
      where: { organizationId: orgId },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    console.log(JSON.stringify({
      ok: true,
      portals: portals.map((p) => ({
        slug: p.slug,
        companyName: p.companyName,
        isActive: p.isActive,
        lastUpdated: p.lastUpdated,
        username: p.username,
        createdAt: p.createdAt.toISOString(),
      })),
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
