import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: delete-portal --slug <slug> --org-id <orgId>");
    console.log("Soft-deletes a portal by setting isActive=false. Idempotent.");
    process.exit(0);
  }

  const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const slug = getArg("--slug");
  const orgId = getArg("--org-id");

  if (!slug || !orgId) fail("Missing --slug or --org-id");

  const prisma = new PrismaClient();
  try {
    const portal = await prisma.clientPortal.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });
    if (!portal) fail(`Portal "${slug}" not found`);

    const wasActive = portal.isActive;

    if (wasActive) {
      await prisma.clientPortal.update({
        where: { id: portal.id },
        data: { isActive: false },
      });
    }

    console.log(JSON.stringify({ ok: true, slug, wasActive }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
