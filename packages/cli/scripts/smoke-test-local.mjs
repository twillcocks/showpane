#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const cliDir = path.resolve(import.meta.dirname, "..");
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const requiredMarkers = [
  "Database ready",
  "Example portal seeded",
  "Ready!",
];

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
  console.log("\nSmoke test passed.");
  console.log(`Artifacts: ${testRoot}`);
}

main().catch((error) => {
  console.error("\nSmoke test failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
