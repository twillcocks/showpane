import { PrismaClient } from "@/lib/prisma-client";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: get-org --slug <orgSlug>");
    console.log("Looks up a local Showpane organization by slug.");
    process.exit(0);
  }

  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const slug = getArg("--slug");
  if (!slug) {
    fail("Missing --slug");
  }

  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });

    if (!org) {
      fail(`Organization "${slug}" not found`);
    }

    console.log(JSON.stringify({ ok: true, org }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail(String(error));
});
