import fs from "node:fs";
import path from "node:path";

const ORGANIZATION_REQUIRED_ERROR = "organization_required";
const ORGANIZATION_NOT_READY_ERROR = "organization_not_ready";

type OrganizationNotReadyPayload = {
  code: typeof ORGANIZATION_NOT_READY_ERROR;
  error: string;
  orgSlug: string;
  reason: string;
  nextAction: string;
  retryable: boolean;
  retryAfterMs?: number;
};

type ShowpaneConfig = {
  accessToken?: string;
};

type CloudProjectLink = {
  projectId: string;
  orgId: string;
  projectName: string;
  settings: {
    createdAt: number;
    framework: string;
    devCommand: string | null;
    installCommand: string | null;
    buildCommand: string | null;
    outputDirectory: string | null;
    rootDirectory: string | null;
    directoryListing: boolean;
    nodeVersion: string;
  };
};

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function getConfig(): ShowpaneConfig {
  const configPath = path.join(process.env.HOME || "", ".showpane", "config.json");
  if (!fs.existsSync(configPath)) {
    fail("Showpane not configured");
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8")) as ShowpaneConfig;
}

async function main() {
  const config = getConfig();
  if (!config.accessToken) {
    fail("Missing cloud access token. Run showpane login.");
  }

  const apiBase = process.env.SHOWPANE_CLOUD_URL || "https://app.showpane.com";
  const res = await fetch(`${apiBase}/api/cli/project-link`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!res.ok) {
    const rawBody = await res.text();
    let body: { code?: string } | null = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody) as { code?: string };
      } catch {
        body = null;
      }
    }
    if (body?.code === ORGANIZATION_REQUIRED_ERROR) {
      fail("Showpane Cloud workspace required. Finish checkout, then retry.");
    }
    if (body?.code === ORGANIZATION_NOT_READY_ERROR) {
      const details = body as OrganizationNotReadyPayload;
      fail(
        `Workspace ${details.orgSlug} is not ready: ${details.error} (${details.reason}, next: ${details.nextAction}).`,
      );
    }
    fail(
      rawBody
        ? `Could not fetch cloud project link (${res.status}): ${rawBody}`
        : `Could not fetch cloud project link (${res.status})`,
    );
  }

  const projectLink = await res.json() as CloudProjectLink;
  const vercelDir = path.join(process.cwd(), ".vercel");
  fs.mkdirSync(vercelDir, { recursive: true });
  fs.writeFileSync(
    path.join(vercelDir, "project.json"),
    `${JSON.stringify(projectLink, null, 2)}\n`,
  );

  console.log(JSON.stringify({
    ok: true,
    path: path.join(vercelDir, "project.json"),
    projectId: projectLink.projectId,
  }));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
