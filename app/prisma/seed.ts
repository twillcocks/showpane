import { PrismaClient } from "@/lib/prisma-client";

const prisma = new PrismaClient();

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWebsiteUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

async function main() {
  const organizationName = process.env.SHOWPANE_ORG_NAME?.trim();
  if (!organizationName) {
    console.log("Seed skipped: no organization details provided");
    return;
  }

  const organizationSlug =
    process.env.SHOWPANE_ORG_SLUG?.trim() || normalizeSlug(organizationName);
  const contactName = process.env.SHOWPANE_CONTACT_NAME?.trim() || null;
  const contactEmail = process.env.SHOWPANE_CONTACT_EMAIL?.trim() || null;
  const websiteUrl = normalizeWebsiteUrl(process.env.SHOWPANE_WEBSITE_URL);
  const contactTitle = "Point of contact";

  const org = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {},
    create: {
      name: organizationName,
      slug: organizationSlug,
      contactName,
      contactTitle,
      contactEmail,
      supportEmail: contactEmail,
      websiteUrl,
    },
  });

  console.log(`Seed complete: org '${org.slug}'`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
