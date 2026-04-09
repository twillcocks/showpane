import { describe, expect, it } from "vitest";

import {
  ANALYTICS_METADATA_KEYS,
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
});
