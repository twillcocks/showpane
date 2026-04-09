import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");

export function getSchemaPath() {
  return path.join(appRoot, "prisma", "schema.local.prisma");
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
