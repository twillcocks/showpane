import { PrismaClient } from "@/lib/prisma-client";
import { getBrandLogoUrl, normalizeWebsiteUrl } from "@/lib/branding";
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
    console.log("Usage: create-portal --slug <slug> --company <name> --org-id <orgId> [--website <domain-or-url>]");
    console.log("Creates a new client portal with auto-generated credentials.");
    process.exit(0);
  }

  const getArg = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  const slug = getArg("--slug");
  const company = getArg("--company");
  const orgId = getArg("--org-id");
  const website = getArg("--website");

  if (!slug || !company || !orgId) fail("Missing --slug, --company, or --org-id");

  // Validate slug
  if (slug.length < 2 || slug.length > 50 || !SLUG_PATTERN.test(slug)) {
    fail("Invalid slug format: 2-50 chars, lowercase alphanumeric and hyphens");
  }
  if (RESERVED.has(slug)) fail(`"${slug}" is a reserved name`);

  const username = slug;
  const password = crypto.randomBytes(16).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 10);
  const websiteUrl = normalizeWebsiteUrl(website);
  const logoUrl = getBrandLogoUrl({
    websiteUrl,
    fallbackName: company,
  });

  const prisma = new PrismaClient();
  try {
    // Check uniqueness
    const existing = await prisma.clientPortal.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });
    if (existing) fail(`Slug "${slug}" already exists`);

    const createData: Record<string, unknown> = {
      organizationId: orgId,
      slug,
      companyName: company,
      logoUrl,
      username,
      passwordHash,
    };

    // Older scaffolded apps may not have the ClientPortal.websiteUrl column yet.
    if (websiteUrl) {
      createData.websiteUrl = websiteUrl;
    }

    let portal;
    try {
      portal = await prisma.clientPortal.create({
        data: createData,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        websiteUrl &&
        (message.includes("Unknown arg `websiteUrl`") ||
          message.includes("Unknown argument `websiteUrl`"))
      ) {
        delete createData.websiteUrl;
        portal = await prisma.clientPortal.create({
          data: createData,
        });
      } else {
        throw error;
      }
    }

    console.log(JSON.stringify({
      ok: true,
      portal: {
        id: portal.id,
        slug: portal.slug,
        username,
        password,
        websiteUrl: portal.websiteUrl,
        logoUrl: portal.logoUrl,
      },
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
