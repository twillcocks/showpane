import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadControlPlaneFile,
  isControlPlaneMode,
  listControlPlaneFiles,
  sendControlPlaneEvent,
} from "@/lib/control-plane";

const ORIGINAL_ENV = { ...process.env };

describe("control-plane helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it("does not enter control-plane mode without a service token", async () => {
    process.env.SHOWPANE_CONTROL_PLANE_URL = "https://cloud.example";
    delete process.env.PORTAL_SERVICE_TOKEN;
    const fetchMock = vi.spyOn(globalThis, "fetch");

    expect(isControlPlaneMode()).toBe(false);
    await expect(listControlPlaneFiles("acme")).rejects.toThrow("Control plane is not configured");
    await sendControlPlaneEvent("acme", { event: "portal_view" });
    const response = await downloadControlPlaneFile("acme", ["deck.pdf"]);

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the configured bearer token when control-plane mode is enabled", async () => {
    process.env.SHOWPANE_CONTROL_PLANE_URL = "https://cloud.example";
    process.env.PORTAL_SERVICE_TOKEN = "secret-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );

    expect(isControlPlaneMode()).toBe(true);
    await listControlPlaneFiles("acme");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.example/api/runtime/files?portalSlug=acme",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret-token" },
      })
    );
  });
});
