// Synced snapshot of ../../packages/portal-contracts/src/index.ts.
// Keep the app-local copy until the app consumes the package directly.

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

const PORTAL_EVENT_TYPE_SET = new Set<string>(PORTAL_EVENT_TYPES);

export function isPortalEventType(value: unknown): value is PortalEventType {
  return typeof value === "string" && PORTAL_EVENT_TYPE_SET.has(value);
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
