import { PrismaClient } from "@/lib/prisma-client";
import { buildAndSignToken, SHARE_TOKEN_MAX_AGE_SECONDS } from "@/lib/token";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: generate-share-link --slug <slug> --org-id <orgId> [--base-url <url>]");
    console.log("Generates a reusable share link for a portal.");
    process.exit(0);
  }

  const slug = getArg(args, "--slug");
  const orgId = getArg(args, "--org-id");
  const baseUrl = getArg(args, "--base-url")
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "http://localhost:3000";

  if (!slug || !orgId) fail("Missing --slug or --org-id");

  if (!process.env.AUTH_SECRET) fail("AUTH_SECRET not set in environment");

  const prisma = new PrismaClient();
  try {
    const portal = await prisma.clientPortal.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
      select: { credentialVersion: true, isActive: true },
    });

    if (!portal) fail(`Portal "${slug}" not found`);
    if (!portal.isActive) fail(`Portal "${slug}" is inactive`);

    const token = await buildAndSignToken(
      orgId,
      slug,
      "share",
      SHARE_TOKEN_MAX_AGE_SECONDS,
      portal.credentialVersion
    );

    if (!token) fail("Failed to sign token — check AUTH_SECRET");

    const shareUrl = `${baseUrl.replace(/\/$/, "")}/client/${slug}/s/${token}`;

    console.log(JSON.stringify({
      ok: true,
      shareUrl,
      expiresIn: "never",
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: String(e) }));
  process.exit(1);
});
