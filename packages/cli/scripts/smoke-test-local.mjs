#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cliDir = path.resolve(import.meta.dirname, "..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const requiredMarkers = [
  "Project created",
  "Dependencies installed",
  "Database configured",
  "Claude skills installed",
  "Showpane is ready",
];
const packageVersion = JSON.parse(
  readFileSync(path.join(cliDir, "package.json"), "utf8")
).version;

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const output = `${stdout}${stderr}`.trim();
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code}\n${output}`
        )
      );
    });
  });
}

async function writeBrowserStub(binDir) {
  const script = "#!/bin/sh\nexit 0\n";
  for (const name of ["open", "xdg-open"]) {
    const stubPath = path.join(binDir, name);
    await fs.writeFile(stubPath, script);
    await fs.chmod(stubPath, 0o755);
  }
}

async function readGeneratedPrismaProvider(projectRoot) {
  const generatedClient = await fs.readFile(
    path.join(projectRoot, "src", "generated", "prisma", "internal", "class.ts"),
    "utf8",
  );
  const providerMatch = generatedClient.match(/"activeProvider": "([^"]+)"/);

  if (!providerMatch) {
    throw new Error("Smoke test failed: could not determine generated Prisma provider.");
  }

  return providerMatch[1];
}

async function assertRawPrismaGenerateUsesProvider(projectRoot, databaseUrl, expectedProvider) {
  await runCommand(
    npxCommand,
    ["prisma", "generate"],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
    },
  );

  const actualProvider = await readGeneratedPrismaProvider(projectRoot);
  if (actualProvider !== expectedProvider) {
    throw new Error(
      `Smoke test failed: raw prisma generate used ${actualProvider} for ${databaseUrl}, expected ${expectedProvider}.`,
    );
  }
}

async function terminateProcessTree(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    try {
      await runCommand("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        cwd: cliDir,
        env: process.env,
      });
    } catch {
      child.kill("SIGTERM");
    }
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  if (child.exitCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function main() {
  console.log("Building CLI...");
  await runCommand("npm", ["run", "build"], { cwd: cliDir, env: process.env });

  console.log("Packing local CLI tarball...");
  const packResult = await runCommand(
    "npm",
    ["pack", "--json"],
    { cwd: cliDir, env: process.env }
  );
  const packJson = JSON.parse(packResult.stdout.trim());
  const tarballName = packJson.at(-1)?.filename;

  if (!tarballName) {
    throw new Error(`Could not determine tarball name from npm pack output:\n${packResult.stdout}`);
  }

  const tarballPath = path.join(cliDir, tarballName);
  const testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "showpane-smoke-"));
  const fakeBin = path.join(testRoot, "bin");
  await fs.mkdir(fakeBin, { recursive: true });
  await writeBrowserStub(fakeBin);

  console.log(`Running installer smoke test in ${testRoot}`);
  console.log("Injecting conflicting parent DATABASE_URL to verify local override...");

  const child = spawn(npxCommand, [`file:${tarballPath}`], {
    cwd: testRoot,
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://wrong-host/db",
      PATH: `${fakeBin}${path.delimiter}${process.env.PATH ?? ""}`,
    },
    detached: process.platform !== "win32",
    stdio: ["pipe", "pipe", "pipe"],
  });

  let output = "";
  let sentCompanyName = false;

  const finish = new Promise((resolve, reject) => {
    let settled = false;
    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    const settleReject = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const timeout = setTimeout(() => {
      void terminateProcessTree(child);
      settleReject(new Error(`Smoke test timed out.\n${output.slice(-8000)}`));
    }, 180_000);

    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);

      if (!sentCompanyName && output.includes("What's your company name?")) {
        sentCompanyName = true;
        child.stdin.write("Bidgen\n");
      }

      if (output.includes("Failed to set up the database")) {
        clearTimeout(timeout);
        void terminateProcessTree(child);
        settleReject(new Error(`Installer hit database setup failure.\n${output.slice(-8000)}`));
        return;
      }

      if (requiredMarkers.every((marker) => output.includes(marker))) {
        clearTimeout(timeout);
        settleResolve();
      }
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (error) => {
      clearTimeout(timeout);
      settleReject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (requiredMarkers.every((marker) => output.includes(marker))) {
        settleResolve();
        return;
      }

      settleReject(
        new Error(
          `Smoke test exited before success (code=${code}, signal=${signal}).\n${output.slice(-8000)}`
        )
      );
    });
  });

  await finish;
  await terminateProcessTree(child);

  const projectRoot = path.join(testRoot, "showpane-bidgen");
  const gitDirExists = await fs.stat(path.join(projectRoot, ".git")).then(() => true).catch(() => false);
  const rootPackageExists = await fs.stat(path.join(projectRoot, "package.json")).then(() => true).catch(() => false);
  const nestedAppPackageExists = await fs.stat(path.join(projectRoot, "app", "package.json")).then(() => true).catch(() => false);
  const generatedPackageJson = JSON.parse(
    await fs.readFile(path.join(projectRoot, "package.json"), "utf8"),
  );
  const gitRemoteResult = await runCommand("git", ["remote", "-v"], {
    cwd: projectRoot,
    env: process.env,
  });
  const toolchainRoot = path.join(os.homedir(), ".showpane", "toolchains", packageVersion);
  const toolchainExists = await fs.stat(toolchainRoot).then(() => true).catch(() => false);
  const projectedSkillExists = await fs.stat(path.join(os.homedir(), ".claude", "skills", "portal-create", "SKILL.md")).then(() => true).catch(() => false);
  const generatedPrismaClientExists = await fs.stat(path.join(projectRoot, "src", "generated", "prisma", "client.ts")).then(() => true).catch(() => false);

  if (output.includes("Cloning into")) {
    throw new Error("Smoke test failed: installer still used git clone output.");
  }
  if (output.includes("Update available 6.19.2 -> 7.7.0")) {
    throw new Error("Smoke test failed: Prisma update notifier is still present.");
  }
  if (output.includes("You did not specify an output path for your `generator`")) {
    throw new Error("Smoke test failed: Prisma output-path deprecation warning is still present.");
  }
  if (output.includes("packages are looking for funding")) {
    throw new Error("Smoke test failed: npm funding output is still present.");
  }
  if (output.includes("high severity vulnerabilities") || output.includes("npm audit fix")) {
    throw new Error("Smoke test failed: npm audit output is still present.");
  }
  if (output.includes("Available skills:")) {
    throw new Error("Smoke test failed: legacy success screen still shows the skills list.");
  }
  if (output.includes("Don't have Claude Code?")) {
    throw new Error("Smoke test failed: legacy Claude Code promo is still present.");
  }
  if (output.includes("Open Claude Code and create your first portal:")) {
    throw new Error("Smoke test failed: legacy success copy is still present.");
  }
  if (output.includes("Git repository initialized")) {
    throw new Error("Smoke test failed: git initialization leaked outside the stepper.");
  }
  if (!gitDirExists) {
    throw new Error("Smoke test failed: generated project is missing a .git directory.");
  }
  if (!rootPackageExists || nestedAppPackageExists) {
    throw new Error("Smoke test failed: generated project layout is not app-at-root.");
  }
  if (gitRemoteResult.stdout.trim() || gitRemoteResult.stderr.trim()) {
    throw new Error(`Smoke test failed: generated project has git remotes.\n${gitRemoteResult.stdout}${gitRemoteResult.stderr}`);
  }
  if (!toolchainExists || !projectedSkillExists) {
    throw new Error("Smoke test failed: global toolchain or projected Claude skills were not installed.");
  }
  if (!generatedPrismaClientExists) {
    throw new Error("Smoke test failed: generated Prisma client output is missing.");
  }
  if ("db:migrate" in (generatedPackageJson.scripts ?? {})) {
    throw new Error("Smoke test failed: generated project still exposes db:migrate.");
  }

  for (const relativePath of [
    "prisma/schema.prisma",
    "prisma/migrations",
    ".vercel/project.json",
    "docker-compose.yml",
    "docker",
    "scripts/backup.sh",
    "scripts/e2e-verify.sh",
    "scripts/restore.sh",
  ]) {
    const exists = await fs
      .stat(path.join(projectRoot, relativePath))
      .then(() => true)
      .catch(() => false);
    if (exists) {
      throw new Error(`Smoke test failed: generated project still includes ${relativePath}.`);
    }
  }

  await assertRawPrismaGenerateUsesProvider(projectRoot, "file:./dev.db", "sqlite");
  for (const marker of [
    "Showpane is ready",
    "Project:",
    "App:",
    "Next (in a new terminal window):",
    "Your current terminal is running the local app logs",
    "Try:",
  ]) {
    if (!output.includes(marker)) {
      throw new Error(`Smoke test failed: success card marker missing: ${marker}`);
    }
  }

  console.log("\nSmoke test passed.");
  console.log(`Artifacts: ${testRoot}`);
}

main().catch((error) => {
  console.error("\nSmoke test failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
