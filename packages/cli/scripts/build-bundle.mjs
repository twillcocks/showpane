#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(cliDir, "..", "..");
const bundleRoot = path.join(cliDir, "bundle");
const scaffoldOut = path.join(bundleRoot, "scaffold");
const toolchainOut = path.join(bundleRoot, "toolchain");
const metaOut = path.join(bundleRoot, "meta");
const excludedScaffoldPaths = [
  ".vercel/",
  "docker/",
  "docker-compose.yml",
  "scripts/backup.sh",
  "scripts/e2e-verify.sh",
  "scripts/restore.sh",
];

function rimraf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function copyTrackedFile(sourcePath, targetPath) {
  ensureDir(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);

  const sourceMode = fs.statSync(sourcePath).mode & 0o777;
  fs.chmodSync(targetPath, sourceMode);
}

function hashFile(sourcePath) {
  return createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex");
}

function bundledScaffoldPath(relativePath) {
  const dirName = path.dirname(relativePath);
  const baseName = path.basename(relativePath);
  const bundledBaseName = baseName.startsWith(".")
    ? `__dot__${baseName.slice(1)}`
    : baseName;

  return dirName === "." ? bundledBaseName : path.join(dirName, bundledBaseName);
}

function gitTrackedFiles(...roots) {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...roots],
    { cwd: repoRoot, encoding: "utf8" }
  );

  return output.split("\0").filter(Boolean);
}

function shouldExcludeScaffoldPath(relativePath) {
  return excludedScaffoldPaths.some((pattern) =>
    pattern.endsWith("/") ? relativePath.startsWith(pattern) : relativePath === pattern
  );
}

rimraf(bundleRoot);
ensureDir(scaffoldOut);
ensureDir(toolchainOut);
ensureDir(metaOut);

const scaffoldManifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scaffoldVersion: fs.readFileSync(path.join(repoRoot, "app", "VERSION"), "utf8").trim(),
  files: {},
};

for (const relativePath of gitTrackedFiles("app")) {
  const sourcePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }
  const targetRelativePath = relativePath.replace(/^app\//, "");
  if (shouldExcludeScaffoldPath(targetRelativePath)) {
    continue;
  }
  const targetPath = path.join(scaffoldOut, bundledScaffoldPath(targetRelativePath));

  copyTrackedFile(sourcePath, targetPath);
  scaffoldManifest.files[targetRelativePath] = hashFile(sourcePath);
}

for (const relativePath of gitTrackedFiles("skills", "bin", "templates")) {
  const sourcePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    continue;
  }
  const targetPath = path.join(toolchainOut, relativePath);
  copyTrackedFile(sourcePath, targetPath);
}

copyTrackedFile(
  path.join(repoRoot, "VERSION"),
  path.join(toolchainOut, "VERSION")
);

fs.writeFileSync(
  path.join(metaOut, "scaffold-manifest.json"),
  `${JSON.stringify(scaffoldManifest, null, 2)}\n`
);
