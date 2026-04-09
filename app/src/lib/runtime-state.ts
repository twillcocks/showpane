import { readFile } from "fs/promises";
import path from "path";
import type { RuntimeStatePayload } from "@/lib/portal-contracts";

export type RuntimeState = RuntimeStatePayload;

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
