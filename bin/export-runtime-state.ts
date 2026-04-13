import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

type Args = {
  orgId?: string;
  orgSlug?: string;
};

function parseArgs(argv: string[]): Args {
  const getArg = (flag: string) => {
    const index = argv.indexOf(flag);
    return index !== -1 ? argv[index + 1] : undefined;
  };

  return {
    orgId: getArg("--org-id"),
    orgSlug: getArg("--org-slug"),
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: export-runtime-state [--org-id <orgId>] [--org-slug <slug>]");
    console.log("Exports the local portal runtime state for cloud deploy sync.");
    process.exit(0);
  }

  const { orgId, orgSlug } = parseArgs(args);
  const prisma = new PrismaClient();

  try {
    const organization = orgId
      ? await prisma.organization.findUnique({ where: { id: orgId } })
      : orgSlug
        ? await prisma.organization.findUnique({ where: { slug: orgSlug } })
        : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" } });

    if (!organization) {
      fail("No organization found");
    }

    const portals = await prisma.clientPortal.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
      select: {
        slug: true,
        companyName: true,
        websiteUrl: true,
        logoUrl: true,
        username: true,
        passwordHash: true,
        credentialVersion: true,
        isActive: true,
        lastUpdated: true,
      },
    });

    console.log(JSON.stringify({
      ok: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
        logoUrl: organization.logoUrl,
        primaryColor: organization.primaryColor,
        portalLabel: organization.portalLabel,
        websiteUrl: organization.websiteUrl,
        contactName: organization.contactName,
        contactTitle: organization.contactTitle,
        contactEmail: organization.contactEmail,
        contactPhone: organization.contactPhone,
        contactAvatar: organization.contactAvatar,
        supportEmail: organization.supportEmail,
        customDomain: organization.customDomain,
      },
      portals,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail(String(error));
});
