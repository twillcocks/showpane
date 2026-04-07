#!/usr/bin/env node

import { createInterface } from "node:readline";
import { execSync, spawn, exec } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const RED = "\x1b[31m";

function green(msg: string) {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}

function blue(msg: string) {
  console.log(`  ${BLUE}→${RESET} ${msg}`);
}

function error(msg: string) {
  console.error(`  ${RED}✗${RESET} ${msg}`);
}

// ── ASCII banner ──────────────────────────────────────────────────────────────

function printBanner() {
  const banner = `
${BOLD}${WHITE}  ███████╗██╗  ██╗ ██████╗ ██╗    ██╗██████╗  █████╗ ███╗   ██╗███████╗
  ██╔════╝██║  ██║██╔═══██╗██║    ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝
  ███████╗███████║██║   ██║██║ █╗ ██║██████╔╝███████║██╔██╗ ██║█████╗
  ╚════██║██╔══██║██║   ██║██║███╗██║██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝
  ███████║██║  ██║╚██████╔╝╚███╔███╔╝██║     ██║  ██║██║ ╚████║███████╗
  ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝${RESET}
${DIM}  Client portals that close deals.${RESET}
`;
  console.log(banner);
}

// ── Prompt helper ─────────────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Port probing ──────────────────────────────────────────────────────────────

function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

// ── Shell exec helper ─────────────────────────────────────────────────────────

function run(cmd: string, cwd?: string) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── Open browser (cross-platform) ────────────────────────────────────────────

function openBrowser(url: string) {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${cmd} ${url}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Handle --version flag
  if (process.argv.includes("--version")) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
    console.log(pkg.version);
    process.exit(0);
  }

  printBanner();

  // 1. Ask for company name
  const companyName = await ask(`  ${BOLD}What's your company name?${RESET} `);

  if (!companyName) {
    error("Company name is required.");
    process.exit(1);
  }

  const slug = toSlug(companyName);
  const dirName = `showpane-${slug}`;

  console.log();
  blue(`Setting up ${BOLD}${companyName}${RESET} portal as ${DIM}${dirName}/${RESET}`);
  console.log();

  // 2. Clone repo
  try {
    run(
      `git clone --depth 1 https://github.com/twillcocks/showpane.git ${dirName}`
    );
    green("Cloned repository");
  } catch {
    error("Failed to clone repository. Check your internet connection and try again.");
    process.exit(1);
  }

  const appDir = resolve(process.cwd(), dirName, "app");

  // 3. Install dependencies
  try {
    run("npm install", appDir);
    green("Dependencies installed");
  } catch {
    error("Failed to install dependencies.");
    process.exit(1);
  }

  // 4. Create .env
  const authSecret = randomBytes(32).toString("hex");
  const envContent = `DATABASE_URL="file:./dev.db"\nAUTH_SECRET="${authSecret}"\n`;
  writeFileSync(resolve(appDir, ".env"), envContent);
  green("Environment configured");

  // 5. Run Prisma migrations
  try {
    run("npx prisma migrate dev --name init", appDir);
    green("Database ready");
  } catch {
    error("Failed to set up the database. Check Prisma schema and try again.");
    process.exit(1);
  }

  // 6. Find a free port
  const port = await findFreePort(3000);
  green(`Server starting on port ${port}`);

  // 7. Start dev server
  const url = `http://localhost:${port}`;
  blue(`Opening ${url}`);
  console.log();

  const devServer = spawn("npm", ["run", "dev"], {
    cwd: appDir,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  // Give the server a moment to start, then open the browser
  setTimeout(() => {
    openBrowser(url);
  }, 3000);

  devServer.on("close", (code) => {
    if (code !== 0) {
      error(`Dev server exited with code ${code}`);
    }
    process.exit(code ?? 1);
  });

  // Forward signals to the child process
  process.on("SIGINT", () => {
    devServer.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    devServer.kill("SIGTERM");
  });
}

main().catch((err) => {
  error(String(err));
  process.exit(1);
});
