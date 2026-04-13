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
export const ORGANIZATION_NOT_READY_ERROR = "organization_not_ready" as const;

export const WORKSPACE_NEXT_ACTIONS = [
  "open_checkout",
  "wait_for_provisioning",
  "open_settings",
  "manage_billing",
] as const;

export type WorkspaceNextAction = (typeof WORKSPACE_NEXT_ACTIONS)[number];

export const WORKSPACE_READINESS_REASONS = [
  "billing_inactive",
  "provisioning",
  "provisioning_issue",
  "workspace_incomplete",
] as const;

export type WorkspaceReadinessReason =
  (typeof WORKSPACE_READINESS_REASONS)[number];

export interface OrganizationNotReadyPayload {
  code: typeof ORGANIZATION_NOT_READY_ERROR;
  error: string;
  orgSlug: string;
  provisioningStatus: string | null;
  subscriptionStatus: string | null;
  isActive: boolean;
  retryable: boolean;
  retryAfterMs?: number;
  checkoutUrl?: string;
  settingsUrl: string;
  nextAction: WorkspaceNextAction;
  reason: WorkspaceReadinessReason;
}

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
