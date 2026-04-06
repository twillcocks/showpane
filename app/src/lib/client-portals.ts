import { prisma } from "@/lib/db";

type ClientPortalRow = {
  slug: string;
  companyName: string;
  username: string;
  passwordHash: string;
  credentialVersion: string;
};

export async function getClientPortalBySlug(
  slug: string
): Promise<ClientPortalRow | null> {
  const portal = await prisma.clientPortal.findFirst({
    where: { slug, isActive: true },
    select: {
      slug: true,
      companyName: true,
      username: true,
      passwordHash: true,
      credentialVersion: true,
    },
  });
  return portal;
}

export async function getClientPortalByUsername(
  username: string
): Promise<ClientPortalRow | null> {
  const portal = await prisma.clientPortal.findFirst({
    where: { username, isActive: true },
    select: {
      slug: true,
      companyName: true,
      username: true,
      passwordHash: true,
      credentialVersion: true,
    },
  });
  return portal;
}

/** Validate login credentials. Returns the matching slug or null. */
export async function validateClientLogin(
  username: string,
  password: string
): Promise<string | null> {
  const portal = await getClientPortalByUsername(username);
  if (!portal) return null;
  const bcrypt = await import("bcryptjs");
  const match = await bcrypt.compare(password, portal.passwordHash);
  return match ? portal.slug : null;
}

/** Get the credential version string for token signing/verification. */
export async function getCredentialVersion(
  slug: string
): Promise<string | null> {
  const portal = await getClientPortalBySlug(slug);
  return portal?.credentialVersion ?? null;
}
