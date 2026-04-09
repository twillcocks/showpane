import { PrismaClient } from "@/lib/prisma-client";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
const RESERVED = new Set([
  "api", "client", "s", "admin", "static", "_next", "health", "example",
]);

function fail(reason: string, message: string): never {
  console.error(JSON.stringify({ valid: false, reason, message }));
  process.exit(1);
}

function success(): never {
  console.log(JSON.stringify({ valid: true }));
  process.exit(0);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: check-slug --slug <slug> --org-id <orgId>");
    console.log("Validates a portal slug for format, reserved names, and uniqueness.");
    process.exit(0);
  }

  const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const slug = getArg("--slug");
  const orgId = getArg("--org-id");

  if (!slug || !orgId) fail("args", "Missing --slug or --org-id");

  // Format check: lowercase alphanumeric + hyphens, 2-50 chars
  if (slug.length < 2 || slug.length > 50 || !SLUG_PATTERN.test(slug)) {
    fail("format", "Slug must be 2-50 chars, lowercase alphanumeric and hyphens, cannot start/end with hyphen");
  }

  // Reserved names
  if (RESERVED.has(slug)) {
    fail("reserved", `"${slug}" is a reserved name`);
  }

  // DB uniqueness
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.clientPortal.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });
    if (existing) fail("taken", `Slug "${slug}" is already in use`);
    success();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ valid: false, reason: "error", message: String(e) }));
  process.exit(1);
});
