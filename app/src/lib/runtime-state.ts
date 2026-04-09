import { readFile } from "fs/promises";
import path from "path";

export type RuntimePortalSnapshot = {
  slug: string;
  companyName: string;
  logoUrl?: string | null;
  username: string;
  passwordHash: string;
  credentialVersion: string;
  isActive: boolean;
  lastUpdated?: string | null;
};

export type RuntimeOrganizationSnapshot = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string | null;
  primaryColor?: string;
  portalLabel?: string;
  websiteUrl?: string | null;
  contactName?: string | null;
  contactTitle?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAvatar?: string | null;
  supportEmail?: string | null;
  customDomain?: string | null;
};

export type RuntimeState = {
  organization: RuntimeOrganizationSnapshot;
  portals: RuntimePortalSnapshot[];
};

let cachedState: RuntimeState | null | undefined;

function getRuntimeStatePath(): string {
  return process.env.SHOWPANE_RUNTIME_STATE_PATH || path.join(process.cwd(), "runtime", "runtime-state.json");
}

export function isRuntimeSnapshotMode(): boolean {
  return Boolean(process.env.SHOWPANE_RUNTIME_STATE_PATH);
}

export async function getRuntimeState(): Promise<RuntimeState | null> {
  if (!isRuntimeSnapshotMode()) return null;
  if (cachedState !== undefined) return cachedState;

  try {
    const raw = await readFile(getRuntimeStatePath(), "utf8");
    cachedState = JSON.parse(raw) as RuntimeState;
    return cachedState;
  } catch {
    cachedState = null;
    return null;
  }
}

export async function getRuntimePortalBySlug(slug: string) {
  const state = await getRuntimeState();
  return state?.portals.find((portal) => portal.slug === slug && portal.isActive) ?? null;
}

export async function getRuntimePortalByUsername(username: string) {
  const state = await getRuntimeState();
  return state?.portals.find((portal) => portal.username === username && portal.isActive) ?? null;
}
