import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

type ShowpaneConfig = {
  accessToken?: string;
  accessTokenExpiresAt?: string | null;
  app_path?: string;
  deploy_mode?: string;
  orgSlug?: string;
  portalUrl?: string | null;
};

type RuntimeStatePayload = {
  organization?: {
    slug?: string;
  };
  portals?: Array<{
    slug: string;
    isActive: boolean;
  }>;
};

type FileManifestEntry = {
  portalSlug: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  checksum: string;
};

type DeploymentInitResponse = {
  deploymentId: string;
  status: string;
  artifactStoragePath: string;
  artifactUploadUrl: string | null;
  artifactUploaded: boolean;
  liveUrl: string | null;
  missingFiles?: FileManifestEntry[];
  error?: string;
};

type DeploymentFinalizeResponse = {
  deploymentId: string;
  status: string;
  liveUrl: string | null;
  inspectorUrl: string | null;
  prebuilt: boolean | null;
  buildSkipped: boolean | null;
  error?: string | null;
};

type DeploymentStatusResponse = {
  deploymentId: string;
  status: string;
  liveUrl: string | null;
  inspectorUrl: string | null;
  prebuilt: boolean | null;
  buildSkipped: boolean | null;
  error?: string | null;
  terminal?: boolean;
  retryable?: boolean;
  pollAfterMs?: number | null;
  nextAction?: string;
  artifactUploaded?: boolean;
};

type DeployResult = {
  ok: true;
  deploymentId: string;
  status: string;
  liveUrl: string | null;
  inspectorUrl: string | null;
  portalCount: number;
  firstPortalSlug: string | null;
  fileSyncCount: number;
  verification: {
    portalStatus: number | null;
    healthStatus: number | null;
  };
};

type DeployFailure = {
  ok: false;
  step: string;
  error: string;
  detail?: unknown;
};

type DeployArgs = {
  appPath?: string;
  wait: boolean;
  json: boolean;
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const SHOWPANE_HOME = path.join(os.homedir(), ".showpane");
const DEFAULT_API_BASE = process.env.SHOWPANE_CLOUD_URL || "https://app.showpane.com";
const MAX_BUFFER = 50 * 1024 * 1024;
const MAX_WAIT_MS = 5 * 60 * 1000;
const MAX_STATUS_ERROR_RETRIES = 3;

function parseArgs(argv: string[]): DeployArgs {
  const getArg = (flag: string) => {
    const index = argv.indexOf(flag);
    return index !== -1 ? argv[index + 1] : undefined;
  };

  if (argv.includes("--help")) {
    console.log("Usage: deploy-to-cloud [--app-path <path>] [--wait] [--json]");
    process.exit(0);
  }

  return {
    appPath: getArg("--app-path"),
    wait: argv.includes("--wait"),
    json: argv.includes("--json"),
  };
}

function readConfig(): ShowpaneConfig {
  const configPath = path.join(SHOWPANE_HOME, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("Showpane not configured. Run showpane login.");
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8")) as ShowpaneConfig;
}

function out(message: string, json: boolean) {
  (json ? process.stderr : process.stdout).write(`${message}\n`);
}

function ok(result: DeployResult, json: boolean): never {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else {
    console.log();
    console.log("Cloud deploy complete");
    console.log();
    console.log(`  Status:     ${result.status}`);
    console.log(`  Deploy ID:  ${result.deploymentId}`);
    console.log(`  Live URL:   ${result.liveUrl ?? "pending"}`);
    console.log(`  Portals:    ${result.portalCount}`);
    console.log(`  File sync:  ${result.fileSyncCount}`);
    if (result.inspectorUrl) {
      console.log(`  Inspector:  ${result.inspectorUrl}`);
    }
    if (result.firstPortalSlug) {
      console.log(`  First:      ${result.firstPortalSlug}`);
    }
    console.log();
  }
  process.exit(0);
}

function fail(step: string, error: string, json: boolean, detail?: unknown): never {
  const payload: DeployFailure = { ok: false, step, error, detail };
  if (json) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    console.error(`ERROR [${step}]: ${error}`);
    if (detail !== undefined) {
      console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
    }
  }
  process.exit(1);
}

function resolveAppPath(config: ShowpaneConfig, args: DeployArgs): string {
  if (args.appPath) {
    return path.resolve(args.appPath);
  }
  if (process.env.SHOWPANE_APP_PATH) {
    return path.resolve(process.env.SHOWPANE_APP_PATH);
  }
  if (config.app_path) {
    return path.resolve(config.app_path);
  }
  return process.cwd();
}

function shouldSkipCopy(relativePath: string): boolean {
  return (
    relativePath === ".next" ||
    relativePath.startsWith(`.next${path.sep}`) ||
    relativePath === "node_modules" ||
    relativePath.startsWith(`node_modules${path.sep}`) ||
    relativePath === path.join(".vercel", "output") ||
    relativePath.startsWith(path.join(".vercel", "output") + path.sep)
  );
}

function copyWorkspaceForBuild(sourcePath: string): {
  path: string;
  cleanup(): void;
} {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-cloud-build-"));
  const buildPath = path.join(tempRoot, path.basename(sourcePath));
  fs.cpSync(sourcePath, buildPath, {
    recursive: true,
    dereference: false,
    filter: (src) => {
      const relativePath = path.relative(sourcePath, src);
      if (!relativePath) return true;
      return !shouldSkipCopy(relativePath);
    },
  });

  const sourceNodeModules = path.join(sourcePath, "node_modules");
  if (fs.existsSync(sourceNodeModules)) {
    fs.symlinkSync(sourceNodeModules, path.join(buildPath, "node_modules"), "dir");
  }

  return {
    path: buildPath,
    cleanup() {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

function runCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    json: boolean;
    step: string;
  },
) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    fail(
      options.step,
      `${command} ${args.join(" ")} failed`,
      options.json,
      (result.stderr || result.stdout || "").trim(),
    );
  }

  if (!options.json) {
    if (result.stdout?.trim()) process.stdout.write(result.stdout);
    if (result.stderr?.trim()) process.stderr.write(result.stderr);
  }

  return result.stdout?.trim() ?? "";
}

function runToolchainTsScript<T>(
  appPath: string,
  scriptName: string,
  args: string[],
  json: boolean,
): T {
  const appTsconfigPath = path.join(appPath, "tsconfig.json");
  const output = runCommand(
    "npx",
    [
      "tsx",
      "--tsconfig",
      appTsconfigPath,
      path.join(scriptDir, scriptName),
      ...args,
    ],
    {
      cwd: appPath,
      env: {
        NODE_PATH: path.join(appPath, "node_modules"),
      },
      json,
      step: scriptName,
    },
  );

  try {
    return JSON.parse(output) as T;
  } catch {
    fail(scriptName, "Expected JSON output from helper script", json, output);
  }
}

async function fetchJson<T>(
  input: string,
  init: RequestInit,
  json: boolean,
  step: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    fail(step, error instanceof Error ? error.message : String(error), json);
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = payload ?? text;
    const parsedError =
      payload && typeof payload === "object" && "error" in (payload as Record<string, unknown>)
        ? (payload as Record<string, unknown>).error
        : null;
    fail(
      step,
      typeof parsedError === "string" && parsedError
        ? parsedError
        : `HTTP ${response.status}`,
      json,
      detail,
    );
  }

  return (payload ?? {}) as T;
}

function buildHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeDeploymentStatus(
  response: DeploymentStatusResponse,
): Required<Pick<DeploymentStatusResponse, "terminal" | "retryable" | "pollAfterMs" | "nextAction" | "artifactUploaded">> &
  DeploymentStatusResponse {
  const status = response.status;
  const inferredTerminal = status === "live" || status === "failed" || status === "unhealthy";
  const inferredRetryable = !inferredTerminal;
  const inferredPollAfterMs = inferredTerminal ? null : 5_000;
  const inferredNextAction =
    status === "live"
      ? "done"
      : status === "awaiting_upload"
        ? "upload_artifact"
        : status === "failed" || status === "unhealthy"
          ? response.inspectorUrl
            ? "open_inspector"
            : "retry_deploy"
          : "wait";
  const inferredArtifactUploaded =
    response.artifactUploaded ??
    status !== "awaiting_upload";

  return {
    ...response,
    terminal: response.terminal ?? inferredTerminal,
    retryable: response.retryable ?? inferredRetryable,
    pollAfterMs:
      response.pollAfterMs === undefined
        ? inferredPollAfterMs
        : response.pollAfterMs,
    nextAction: response.nextAction ?? inferredNextAction,
    artifactUploaded: inferredArtifactUploaded,
  };
}

async function verifyUrl(
  url: string,
  acceptableStatuses: number[],
): Promise<number | null> {
  try {
    const response = await fetch(url, { redirect: "manual" });
    return acceptableStatuses.includes(response.status) ? response.status : response.status;
  } catch {
    return null;
  }
}

async function uploadMissingFiles(
  appPath: string,
  files: FileManifestEntry[],
  token: string,
  apiBase: string,
  json: boolean,
): Promise<number> {
  if (files.length === 0) {
    return 0;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-file-sync-"));
  try {
    for (const file of files) {
      const tempPath = path.join(tempDir, file.checksum);
      const appTsconfigPath = path.join(appPath, "tsconfig.json");
      runCommand(
        "npx",
        [
          "tsx",
          "--tsconfig",
          appTsconfigPath,
          path.join(scriptDir, "materialize-file.ts"),
          "--storage-path",
          file.storagePath,
          "--output",
          tempPath,
        ],
        {
          cwd: appPath,
          env: {
            NODE_PATH: path.join(appPath, "node_modules"),
          },
          json,
          step: `materialize-file:${file.filename}`,
        },
      );

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([fs.readFileSync(tempPath)], { type: file.mimeType }),
        file.filename,
      );
      formData.append("storagePath", file.storagePath);
      formData.append("portalSlug", file.portalSlug);
      formData.append("filename", file.filename);
      formData.append("mimeType", file.mimeType);
      formData.append("size", String(file.size));
      formData.append("uploadedBy", file.uploadedBy);
      formData.append("uploadedAt", file.uploadedAt);
      formData.append("checksum", file.checksum);

      await fetchJson<{ ok: true }>(
        `${apiBase}/api/files/upload`,
        {
          method: "POST",
          headers: buildHeaders(token),
          body: formData,
        },
        json,
        `upload-file:${file.filename}`,
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return files.length;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = readConfig();
  const token = config.accessToken;
  if (!token) {
    fail("auth", "Missing cloud access token. Run showpane login.", args.json);
  }

  const apiBase = DEFAULT_API_BASE;
  const sourceAppPath = resolveAppPath(config, args);
  const portalUrl =
    config.portalUrl ||
    (typeof config.orgSlug === "string" && config.orgSlug
      ? `https://${config.orgSlug}.showpane.com`
      : null);

  out(`Deploying from ${sourceAppPath}`, args.json);

  const health = await fetch(`${apiBase}/api/health`);
  if (!health.ok) {
    fail("health", `Showpane Cloud health check failed (${health.status})`, args.json);
  }

  out("Type-checking app", args.json);
  runCommand("npx", ["tsc", "--noEmit"], {
    cwd: sourceAppPath,
    json: args.json,
    step: "typecheck",
  });

  const buildWorkspace = copyWorkspaceForBuild(sourceAppPath);
  const buildAppPath = buildWorkspace.path;
  const artifactPath = path.join(os.tmpdir(), `showpane-deploy-${Date.now()}.zip`);
  try {
    const projectLinkPath = path.join(buildAppPath, ".vercel", "project.json");
    let projectLinkValid = false;
    if (fs.existsSync(projectLinkPath)) {
      try {
        const payload = JSON.parse(fs.readFileSync(projectLinkPath, "utf8")) as {
          projectId?: string;
          orgId?: string;
        };
        projectLinkValid = Boolean(payload.projectId && payload.orgId);
      } catch {
        projectLinkValid = false;
      }
    }

    if (!projectLinkValid) {
      out("Linking workspace to cloud project", args.json);
      runToolchainTsScript<{ ok: boolean; projectId: string }>(
        buildAppPath,
        "ensure-cloud-project-link.ts",
        [],
        args.json,
      );
    }

    out("Building cloud artifact", args.json);
    runCommand("npm", ["run", "cloud:build"], {
      cwd: buildAppPath,
      json: args.json,
      step: "cloud-build",
    });

    out("Packaging deployment bundle", args.json);
    runToolchainTsScript<{ ok: true; fileCount: number }>(
      buildAppPath,
      "create-deploy-bundle.ts",
      ["--output", artifactPath],
      args.json,
    );

    out("Exporting runtime state", args.json);
    const runtimeData = runToolchainTsScript<RuntimeStatePayload>(
      sourceAppPath,
      "export-runtime-state.ts",
      [],
      args.json,
    );
    const portals = Array.isArray(runtimeData.portals) ? runtimeData.portals : [];
    const portalCount = portals.length;
    const firstPortalSlug =
      portals.find((portal) => portal.isActive)?.slug ?? portals[0]?.slug ?? null;

    out("Exporting file manifest", args.json);
    const manifest = runToolchainTsScript<{ files: FileManifestEntry[] }>(
      sourceAppPath,
      "export-file-manifest.ts",
      [],
      args.json,
    );
    const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];

    out("Initializing cloud deployment", args.json);
    const init = await fetchJson<DeploymentInitResponse>(
      `${apiBase}/api/deployments`,
      {
        method: "POST",
        headers: {
          ...buildHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(manifestFiles.length > 0 ? { files: manifestFiles } : {}),
      },
      args.json,
      "deployment-init",
    );

    const missingFiles = Array.isArray(init.missingFiles) ? init.missingFiles : [];
    let fileSyncCount = 0;

    if (init.status === "awaiting_upload") {
      if (missingFiles.length > 0) {
        out(`Syncing ${missingFiles.length} hosted file(s)`, args.json);
        fileSyncCount = await uploadMissingFiles(
          sourceAppPath,
          missingFiles,
          token,
          apiBase,
          args.json,
        );
      }

      if (!init.artifactUploadUrl) {
        fail("artifact-upload", "Missing artifact upload URL", args.json, init);
      }

      out("Uploading artifact", args.json);
      const uploadResponse = await fetch(init.artifactUploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/zip",
        },
        body: fs.readFileSync(artifactPath),
      });
      if (!uploadResponse.ok) {
        fail(
          "artifact-upload",
          `Artifact upload failed (${uploadResponse.status})`,
          args.json,
        );
      }

      out("Finalizing deployment", args.json);
      await fetchJson<DeploymentFinalizeResponse>(
        `${apiBase}/api/deployments/${init.deploymentId}/finalize`,
        {
          method: "POST",
          headers: {
            ...buildHeaders(token),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ runtimeData }),
        },
        args.json,
        "deployment-finalize",
      );

      if (!args.wait) {
        ok(
          {
            ok: true,
            deploymentId: init.deploymentId,
            status: "publishing",
            liveUrl: init.liveUrl ?? portalUrl,
            inspectorUrl: null,
            portalCount,
            firstPortalSlug,
            fileSyncCount,
            verification: {
              portalStatus: null,
              healthStatus: null,
            },
          },
          args.json,
        );
      }
    }

    if (!args.wait) {
      ok(
        {
          ok: true,
          deploymentId: init.deploymentId,
          status: init.status,
          liveUrl: init.liveUrl ?? portalUrl,
          inspectorUrl: null,
          portalCount,
          firstPortalSlug,
          fileSyncCount,
          verification: {
            portalStatus: null,
            healthStatus: null,
          },
        },
        args.json,
      );
    }

    out("Waiting for deployment to go live", args.json);
    let finalStatus: DeploymentStatusResponse | null = null;
    const waitStart = Date.now();
    let consecutiveStatusErrors = 0;
    while (true) {
      const rawStatusResponse = await fetchJson<DeploymentStatusResponse>(
        `${apiBase}/api/deployments/${init.deploymentId}`,
        {
          headers: buildHeaders(token),
        },
        args.json,
        "deployment-status",
      );
      const statusResponse = normalizeDeploymentStatus(rawStatusResponse);

      finalStatus = statusResponse;
      if (statusResponse.error) {
        consecutiveStatusErrors += 1;
      } else {
        consecutiveStatusErrors = 0;
      }

      if (consecutiveStatusErrors >= MAX_STATUS_ERROR_RETRIES) {
        fail(
          "deployment-status",
          `Deployment status failed repeatedly while still ${statusResponse.status}`,
          args.json,
          statusResponse,
        );
      }

      if (statusResponse.terminal) {
        break;
      }

      if (Date.now() - waitStart > MAX_WAIT_MS) {
        fail(
          "deployment-status",
          "Deployment did not reach a terminal state within 5 minutes",
          args.json,
          statusResponse,
        );
      }

      const delay = statusResponse.pollAfterMs ?? 5_000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!finalStatus) {
      fail("deployment-status", "No deployment status returned", args.json);
    }

    if (finalStatus.status !== "live") {
      fail(
        "deployment-status",
        `Deployment ended in ${finalStatus.status}`,
        args.json,
        finalStatus.error ?? finalStatus,
      );
    }

    const liveUrl = finalStatus.liveUrl ?? init.liveUrl ?? portalUrl;
    const portalStatus = liveUrl && firstPortalSlug
      ? await verifyUrl(
          `${liveUrl.replace(/\/$/, "")}/client/${firstPortalSlug}`,
          [200, 307, 401, 403],
        )
      : null;
    const healthStatus = liveUrl
      ? await verifyUrl(
          `${liveUrl.replace(/\/$/, "")}/api/health`,
          [200],
        )
      : null;

    ok(
      {
        ok: true,
        deploymentId: finalStatus.deploymentId,
        status: finalStatus.status,
        liveUrl,
        inspectorUrl: finalStatus.inspectorUrl,
        portalCount,
        firstPortalSlug,
        fileSyncCount,
        verification: {
          portalStatus,
          healthStatus,
        },
      },
      args.json,
    );
  } finally {
    fs.rmSync(artifactPath, { force: true });
    buildWorkspace.cleanup();
  }
}

main().catch((error) => {
  fail("deploy", error instanceof Error ? error.message : String(error), process.argv.includes("--json"));
});
