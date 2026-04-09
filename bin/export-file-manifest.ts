import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { readFile_ } from "../app/src/lib/storage";

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function parseArgs(argv: string[]) {
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
    console.log("Usage: export-file-manifest [--org-id <orgId>] [--org-slug <slug>]");
    console.log("Exports uploaded file metadata and checksums for cloud file sync.");
    process.exit(0);
  }

  const { orgId, orgSlug } = parseArgs(args);
  const prisma = new PrismaClient();

  try {
    const organization = orgId
      ? await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } })
      : orgSlug
        ? await prisma.organization.findUnique({ where: { slug: orgSlug }, select: { id: true } })
        : await prisma.organization.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });

    if (!organization) {
      fail("No organization found");
    }

    const files = await prisma.portalFile.findMany({
      where: { portal: { organizationId: organization.id } },
      include: {
        portal: {
          select: {
            slug: true,
          },
        },
      },
      orderBy: { uploadedAt: "asc" },
    });

    const manifest = [];
    for (const file of files) {
      const data = await readFile_(file.storagePath);
      if (!data) {
        fail(`File missing from storage: ${file.storagePath}`);
      }

      manifest.push({
        portalSlug: file.portal.slug,
        storagePath: file.storagePath,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        uploadedBy: file.uploadedBy,
        uploadedAt: file.uploadedAt.toISOString(),
        checksum: file.checksum ?? createHash("sha256").update(data).digest("hex"),
      });
    }

    console.log(JSON.stringify({ files: manifest }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail(String(error));
});
