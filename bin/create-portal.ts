import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/;
const RESERVED = new Set([
  "api", "client", "s", "admin", "static", "_next", "health", "example",
]);

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: create-portal --slug <slug> --company <name> --org-id <orgId>");
    console.log("Creates a new client portal with auto-generated credentials.");
    process.exit(0);
  }

  const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const slug = getArg("--slug");
  const company = getArg("--company");
  const orgId = getArg("--org-id");

  if (!slug || !company || !orgId) fail("Missing --slug, --company, or --org-id");

  // Validate slug
  if (slug.length < 2 || slug.length > 50 || !SLUG_PATTERN.test(slug)) {
    fail("Invalid slug format: 2-50 chars, lowercase alphanumeric and hyphens");
  }
  if (RESERVED.has(slug)) fail(`"${slug}" is a reserved name`);

  const username = slug;
  const password = crypto.randomBytes(16).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);

  const prisma = new PrismaClient();
  try {
    // Check uniqueness
    const existing = await prisma.clientPortal.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });
    if (existing) fail(`Slug "${slug}" already exists`);

    const portal = await prisma.clientPortal.create({
      data: {
        organizationId: orgId,
        slug,
        companyName: company,
        username,
        passwordHash,
      },
    });

    console.log(JSON.stringify({
      ok: true,
      portal: { id: portal.id, slug: portal.slug, username, password },
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
