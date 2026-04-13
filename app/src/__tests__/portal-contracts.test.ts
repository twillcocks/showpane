import { describe, expect, it } from "vitest";

import {
  ANALYTICS_METADATA_KEYS,
  ORGANIZATION_NOT_READY_ERROR,
  ORGANIZATION_REQUIRED_ERROR,
  type OrganizationNotReadyPayload,
  isPortalEventType,
  toCloudPortalEventPayload,
} from "@/lib/portal-contracts";

describe("portal contracts", () => {
  it("recognizes valid portal event types", () => {
    expect(isPortalEventType("portal_view")).toBe(true);
    expect(isPortalEventType("section_time")).toBe(true);
    expect(isPortalEventType("cta_click")).toBe(false);
  });

  it("maps local event payloads to cloud payloads", () => {
    expect(
      toCloudPortalEventPayload("acme-health", {
        event: "section_time",
        detail: "pricing",
        visitorId: "visitor-123",
        metadata: { [ANALYTICS_METADATA_KEYS.durationSeconds]: 12 },
      })
    ).toEqual({
      portalSlug: "acme-health",
      eventType: "section_time",
      sectionName: "pricing",
      visitorId: "visitor-123",
      metadata: { durationSeconds: 12 },
    });
  });

  it("exports the shared cloud auth error codes", () => {
    expect(ORGANIZATION_REQUIRED_ERROR).toBe("organization_required");
    expect(ORGANIZATION_NOT_READY_ERROR).toBe("organization_not_ready");
  });

  it("keeps retry metadata on not-ready payloads", () => {
    const payload: OrganizationNotReadyPayload = {
      code: ORGANIZATION_NOT_READY_ERROR,
      error: "Still provisioning",
      orgSlug: "acme",
      provisioningStatus: "provisioning",
      subscriptionStatus: "trialing",
      isActive: true,
      retryable: true,
      retryAfterMs: 3_000,
      settingsUrl: "/dashboard/settings",
      nextAction: "wait_for_provisioning",
      reason: "provisioning",
    };

    expect(payload.retryable).toBe(true);
    expect(payload.retryAfterMs).toBe(3_000);
  });
});
