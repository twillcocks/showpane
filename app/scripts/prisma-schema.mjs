import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1);
    env[key] = parseEnvValue(value);
  }

  return env;
}

export function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envPaths = [
    path.join(appRoot, ".env"),
    path.join(appRoot, ".env.local"),
  ];

  const merged = {};
  for (const envPath of envPaths) {
    Object.assign(merged, parseEnvFile(envPath));
  }

  return merged.DATABASE_URL ?? null;
}

export function getSchemaPath() {
  const databaseUrl = getDatabaseUrl();
  const schemaName = databaseUrl?.startsWith("file:")
    ? "schema.local.prisma"
    : "schema.prisma";

  return path.join(appRoot, "prisma", schemaName);
}

export function runPrismaCommand(args) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(command, ["prisma", ...args], {
    cwd: appRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE ?? "1",
    },
  });
}
