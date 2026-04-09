import { prisma } from "@/lib/db";
import {
  getRuntimePortalBySlug,
  getRuntimePortalByUsername,
  getRuntimeState,
  isRuntimeSnapshotMode,
} from "@/lib/runtime-state";

type ClientPortalRow = {
  organizationId: string;
  slug: string;
  companyName: string;
  username: string;
  passwordHash: string;
  credentialVersion: string;
};

const PORTAL_SELECT = {
  organizationId: true,
  slug: true,
  companyName: true,
  username: true,
  passwordHash: true,
  credentialVersion: true,
} as const;

export async function getClientPortalBySlug(
  organizationId: string,
  slug: string
): Promise<ClientPortalRow | null> {
  if (isRuntimeSnapshotMode()) {
    const portal = await getRuntimePortalBySlug(slug);
    return portal
      ? {
          organizationId,
          slug: portal.slug,
          companyName: portal.companyName,
          username: portal.username,
          passwordHash: portal.passwordHash,
          credentialVersion: portal.credentialVersion,
        }
      : null;
  }

  return prisma.clientPortal.findFirst({
    where: { organizationId, slug, isActive: true },
    select: PORTAL_SELECT,
  });
}

export async function getClientPortalByUsername(
  organizationId: string,
  username: string
): Promise<ClientPortalRow | null> {
  if (isRuntimeSnapshotMode()) {
    const portal = await getRuntimePortalByUsername(username);
    return portal
      ? {
          organizationId,
          slug: portal.slug,
          companyName: portal.companyName,
          username: portal.username,
          passwordHash: portal.passwordHash,
          credentialVersion: portal.credentialVersion,
        }
      : null;
  }

  return prisma.clientPortal.findFirst({
    where: { organizationId, username, isActive: true },
    select: PORTAL_SELECT,
  });
}

/** Look up the portal ID by org-scoped slug. */
export async function getClientPortalId(
  organizationId: string,
  slug: string
): Promise<string | null> {
  const portal = await prisma.clientPortal.findFirst({
    where: { organizationId, slug, isActive: true },
    select: { id: true },
  });
  return portal?.id ?? null;
}

/** Validate login credentials. Returns the matching slug or null. */
export async function validateClientLogin(
  organizationId: string,
  username: string,
  password: string
): Promise<string | null> {
  const portal = await getClientPortalByUsername(organizationId, username);
  if (!portal) return null;
  const bcrypt = await import("bcryptjs");
  const match = await bcrypt.compare(password, portal.passwordHash);
  return match ? portal.slug : null;
}

/** Get the credential version string for token signing/verification. */
export async function getCredentialVersion(
  organizationId: string,
  slug: string
): Promise<string | null> {
  const portal = await getClientPortalBySlug(organizationId, slug);
  return portal?.credentialVersion ?? null;
}

/**
 * Resolve the organizationId for the current request context.
 * Cloud: each Vercel project has ORG_ID set during provisioning.
 * Self-hosted: returns the single org in the DB.
 */
export async function resolveDefaultOrganizationId(): Promise<string | null> {
  if (isRuntimeSnapshotMode()) {
    const state = await getRuntimeState();
    return state?.organization.id ?? process.env.ORG_ID ?? null;
  }

  // Cloud: each Vercel project has ORG_ID set during provisioning
  if (process.env.ORG_ID) {
    const org = await prisma.organization.findUnique({
      where: { id: process.env.ORG_ID },
      select: { id: true },
    });
    return org?.id ?? null;
  }
  // Self-hosted: use the single org in the DB
  const org = await prisma.organization.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return org?.id ?? null;
}
