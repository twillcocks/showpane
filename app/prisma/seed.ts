import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      name: "Demo Company",
      slug: "demo",
      contactName: "Jane Smith",
      contactTitle: "Account Manager",
      contactEmail: "jane@example.com",
      supportEmail: "support@example.com",
      websiteUrl: "https://example.com",
    },
  });

  const passwordHash = await bcrypt.hash("demo-only-password", 10);

  await prisma.clientPortal.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: "example",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      slug: "example",
      companyName: "Acme Health",
      username: "example",
      passwordHash,
      lastUpdated: "2 April 2026",
    },
  });

  console.log("Seed complete: org 'demo', portal 'example' (username: example, password: demo-only-password)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
