import fs from "node:fs";
import path from "node:path";

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
    fail(`Could not fetch cloud project link (${res.status})`);
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
