import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: list-portals [--org-id <orgId>] [--org-slug <slug>]");
    console.log("Lists all client portals. Defaults to first organization if no org filter is provided.");
    process.exit(0);
  }

  const prisma = new PrismaClient();
  try {
    const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
    const orgId = getArg("--org-id");
    const orgSlug = getArg("--org-slug");

    const organization = orgId
      ? await prisma.organization.findUnique({
          where: { id: orgId },
          select: { id: true, name: true, slug: true },
        })
      : orgSlug
        ? await prisma.organization.findUnique({
            where: { slug: orgSlug },
            select: { id: true, name: true, slug: true },
          })
        : await prisma.organization.findFirst({
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, slug: true },
          });

    if (!organization) fail("No organizations found");

    const portals = await prisma.clientPortal.findMany({
      where: { organizationId: organization.id },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    console.log(JSON.stringify({
      ok: true,
      orgId: organization.id,
      orgSlug: organization.slug,
      orgName: organization.name,
      total: portals.length,
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
