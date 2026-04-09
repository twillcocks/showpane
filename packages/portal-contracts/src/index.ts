export const PORTAL_EVENT_TYPES = [
  "portal_view",
  "tab_switch",
  "section_view",
  "section_time",
  "file_download",
  "share_link_access",
] as const;

export type PortalEventType = (typeof PORTAL_EVENT_TYPES)[number];
export const ORGANIZATION_REQUIRED_ERROR = "organization_required" as const;

export const ANALYTICS_METADATA_KEYS = {
  durationSeconds: "durationSeconds",
} as const;

export type PortalEventMetadata = Record<string, unknown> | null;

export interface LocalPortalEventPayload {
  event: PortalEventType;
  detail?: string | null;
  visitorId?: string;
  metadata?: PortalEventMetadata;
}

export interface CloudPortalEventPayload {
  portalSlug: string;
  visitorId?: string;
  eventType: PortalEventType;
  sectionName?: string | null;
  metadata?: PortalEventMetadata;
}

export interface PortalFileSyncManifestEntry {
  portalSlug: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  checksum: string;
}

export interface PortalFileSyncManifestPayload {
  files: PortalFileSyncManifestEntry[];
}

export interface RuntimePortalSnapshot {
  slug: string;
  companyName: string;
  logoUrl?: string | null;
  username: string;
  passwordHash: string;
  credentialVersion: string;
  isActive: boolean;
  lastUpdated?: string | null;
}

export interface RuntimeOrganizationSnapshot {
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
}

export interface RuntimeStatePayload {
  organization: RuntimeOrganizationSnapshot;
  portals: RuntimePortalSnapshot[];
}

export function isPortalEventType(value: string): value is PortalEventType {
  return (PORTAL_EVENT_TYPES as readonly string[]).includes(value);
}

export function toCloudPortalEventPayload(
  portalSlug: string,
  payload: LocalPortalEventPayload
): CloudPortalEventPayload {
  return {
    portalSlug,
    visitorId: payload.visitorId,
    eventType: payload.event,
    sectionName: payload.detail ?? null,
    metadata: payload.metadata ?? null,
  };
}
