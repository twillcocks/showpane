import fs from "node:fs";
import path from "node:path";

function parseEnvValue(rawValue: string) {
  const value = rawValue.trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;

    process.env[key] = parseEnvValue(trimmed.slice(separator + 1));
  }
}

let loaded = false;

export function ensureAppEnvLoaded() {
  if (loaded) return;
  loaded = true;

  const envFiles = [".env.local", ".env"];
  for (const envFile of envFiles) {
    loadEnvFile(path.join(process.cwd(), envFile));
  }
}
