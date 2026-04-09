import { hasSafePathSegments } from "@/lib/files";
import { type LocalPortalEventPayload, toCloudPortalEventPayload } from "@/lib/portal-contracts";

export type ControlPlaneFileRecord = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
};

function getControlPlaneUrl(): string | null {
  return process.env.SHOWPANE_CONTROL_PLANE_URL ?? null;
}

function getPortalServiceToken(): string | null {
  return process.env.PORTAL_SERVICE_TOKEN ?? null;
}

export function isControlPlaneMode(): boolean {
  return Boolean(getControlPlaneUrl() && getPortalServiceToken());
}

function getControlPlaneHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getPortalServiceToken()}`,
  };
}

export async function listControlPlaneFiles(portalSlug: string): Promise<ControlPlaneFileRecord[]> {
  const baseUrl = getControlPlaneUrl();
  if (!baseUrl) return [];

  const res = await fetch(`${baseUrl}/api/runtime/files?portalSlug=${encodeURIComponent(portalSlug)}`, {
    headers: getControlPlaneHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Control-plane file list failed (${res.status})`);
  }

  const body = (await res.json()) as { files?: ControlPlaneFileRecord[] };
  return body.files ?? [];
}

export async function downloadControlPlaneFile(
  portalSlug: string,
  pathSegments: string[]
): Promise<Response> {
  const baseUrl = getControlPlaneUrl();
  if (!baseUrl || !hasSafePathSegments(pathSegments) || pathSegments.length !== 1) {
    return new Response(null, { status: 400 });
  }

  return fetch(
    `${baseUrl}/api/runtime/files/${encodeURIComponent(pathSegments[0])}?portalSlug=${encodeURIComponent(portalSlug)}`,
    {
      headers: getControlPlaneHeaders(),
      cache: "no-store",
    }
  );
}

export async function sendControlPlaneEvent(
  portalSlug: string,
  payload: LocalPortalEventPayload
): Promise<void> {
  const baseUrl = getControlPlaneUrl();
  if (!baseUrl) return;

  await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: {
      ...getControlPlaneHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(toCloudPortalEventPayload(portalSlug, payload)),
  });
}

export async function uploadControlPlaneFile(
  portalSlug: string,
  file: File
): Promise<Response> {
  const baseUrl = getControlPlaneUrl();
  if (!baseUrl) {
    return new Response(JSON.stringify({ error: "Control plane unavailable" }), { status: 503 });
  }

  const formData = new FormData();
  formData.append("portalSlug", portalSlug);
  formData.append("file", file);

  return fetch(`${baseUrl}/api/runtime/files/upload`, {
    method: "POST",
    headers: getControlPlaneHeaders(),
    body: formData,
  });
}
