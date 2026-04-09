#!/usr/bin/env node

import { execSync, spawn } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { createServer } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} = fs;

const { basename, dirname, join, resolve } = path;
const { homedir } = os;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const BLUE = "\x1b[34m";
const WHITE = "\x1b[37m";
const RED = "\x1b[31m";

const API_BASE = "https://app.showpane.com";
const SHOWPANE_HOME = join(homedir(), ".showpane");
const SHOWPANE_BIN_DIR = join(SHOWPANE_HOME, "bin");
const TOOLCHAIN_DIR = join(SHOWPANE_HOME, "toolchains");
const CURRENT_TOOLCHAIN_LINK = join(SHOWPANE_HOME, "current");
const CLAUDE_SKILLS_DIR = join(homedir(), ".claude", "skills");
const SHOWPANE_SHARED_SKILL = "showpane-shared";
const METADATA_DIRNAME = ".showpane";
const PROJECT_METADATA_FILE = "project.json";
const MANAGED_FILES_FILE = "managed-files.json";

type ManifestFiles = Record<string, string>;

type ScaffoldManifest = {
  schemaVersion: number;
  generatedAt: string;
  scaffoldVersion: string;
  files: ManifestFiles;
};

type ProjectMetadata = {
  schemaVersion: number;
  showpaneVersion: string;
  scaffoldVersion: string;
  toolchainVersion: string;
  projectRoot: string;
  installedAt: string;
  lastUpgradedAt: string;
};

type WorkspaceEntry = {
  name: string;
  path: string;
  lastUsedAt: string;
  deployMode: string;
  orgSlug: string;
};

type ShowpaneConfig = {
  accessToken?: string;
  accessTokenExpiresAt?: string | null;
  app_path?: string;
  deploy_mode?: string;
  orgSlug?: string;
  portalUrl?: string | null;
  vercelProjectId?: string | null;
  shellPathConfigured?: boolean;
  shellPathConfiguredProfile?: string | null;
  shellPathPrompted?: boolean;
  workspaces?: WorkspaceEntry[];
  [key: string]: unknown;
};

type UpgradePlan = {
  additions: string[];
  updates: string[];
  deletions: string[];
  conflicts: string[];
};

type CreateOptions = {
  companyName?: string;
  noOpen: boolean;
  verbose: boolean;
  yes: boolean;
};

type ClaudeCommandOptions = CreateOptions & {
  project?: string;
};

type StepSpinner = {
  interval: NodeJS.Timeout;
  label: string;
  startedAt: number;
};

class StepCommandError extends Error {
  output: string;

  constructor(message: string, output = "") {
    super(message);
    this.name = "StepCommandError";
    this.output = output;
  }
}

function green(message: string) {
  console.log(`  ${GREEN}✓${RESET} ${message}`);
}

function blue(message: string) {
  console.log(`  ${BLUE}→${RESET} ${message}`);
}

function error(message: string) {
  console.error(`  ${RED}✗${RESET} ${message}`);
}

function printCreateUsage() {
  console.log("Usage: showpane [--yes --name <company>] [--no-open] [--verbose]");
}

function printClaudeUsage() {
  console.log("Usage: showpane claude [--project <name-or-path>] [--yes --name <company>] [--verbose]");
}

function printBanner() {
  const banner = `
${BOLD}${WHITE}  ███████╗██╗  ██╗ ██████╗ ██╗    ██╗██████╗  █████╗ ███╗   ██╗███████╗
  ██╔════╝██║  ██║██╔═══██╗██║    ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝
  ███████╗███████║██║   ██║██║ █╗ ██║██████╔╝███████║██╔██╗ ██║█████╗
  ╚════██║██╔══██║██║   ██║██║███╗██║██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝
  ███████║██║  ██║╚██████╔╝╚███╔███╔╝██║     ██║  ██║██║ ╚████║███████╗
  ╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝${RESET}
${DIM}  AI-powered client portals.${RESET}
`;
  console.log(banner);
}

function ask(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolveAnswer) => {
    rl.question(question, (answer) => {
      rl.close();
      resolveAnswer(answer.trim());
    });
  });
}

function parseCreateArgs(args: string[]): CreateOptions {
  const options: CreateOptions = {
    noOpen: false,
    verbose: false,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--no-open") {
      options.noOpen = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--name") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --name.");
      }
      options.companyName = value.trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.yes && !options.companyName) {
    throw new Error("`--yes` requires `--name <company>` for a non-interactive install.");
  }

  return options;
}

function parseClaudeArgs(args: string[]): ClaudeCommandOptions {
  const options: ClaudeCommandOptions = {
    noOpen: false,
    verbose: false,
    yes: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--no-open") {
      options.noOpen = true;
      continue;
    }

    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    if (arg === "--name") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --name.");
      }
      options.companyName = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--project") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("Missing value for --project.");
      }
      options.project = value.trim();
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.project && options.companyName) {
    throw new Error("`--project` can not be combined with `--name`.");
  }

  return options;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function run(command: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  execSync(command, {
    cwd,
    stdio: "inherit",
    env: env ? { ...process.env, ...env } : process.env,
  });
}

function capture(command: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  return execSync(command, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8",
  }).trim();
}

function getInstallerEnv(extraEnv?: NodeJS.ProcessEnv) {
  return {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_loglevel: "error",
    npm_config_progress: "false",
    npm_config_update_notifier: "false",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
    ...extraEnv,
  };
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue === rightValue) continue;
    return leftValue > rightValue ? 1 : -1;
  }

  return 0;
}

function maybePrintShowpaneUpdateMessage(currentVersion: string) {
  try {
    const latestVersion = capture("npm view showpane version", undefined, {
      npm_config_update_notifier: "false",
      npm_config_fund: "false",
      npm_config_audit: "false",
    });

    if (!latestVersion || compareVersions(latestVersion, currentVersion) <= 0) {
      return;
    }

    console.log();
    blue(`Update available: showpane ${latestVersion} is out`);
    console.log(`  ${DIM}Run: npx showpane@latest sync${RESET}`);
    console.log();
  } catch {
    // Ignore update-check failures.
  }
}

function normalizePathForComparison(targetPath: string) {
  const normalized = path.normalize(resolve(targetPath));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isShowpaneShimOnPath() {
  const pathValue = process.env.PATH ?? "";
  const binDir = normalizePathForComparison(SHOWPANE_BIN_DIR);
  return pathValue
    .split(path.delimiter)
    .filter(Boolean)
    .some((entry) => normalizePathForComparison(entry) === binDir);
}

function getResumeCommand() {
  return isShowpaneShimOnPath() ? "showpane claude" : "npx showpane claude";
}

function getResumeHint() {
  return isShowpaneShimOnPath()
    ? null
    : `Optional: add ${SHOWPANE_BIN_DIR} to your PATH to use ${BOLD}showpane${RESET} directly.`;
}

function shellPathExportLine() {
  return `export PATH="$HOME/.showpane/bin:$PATH"`;
}

function detectShellProfile() {
  if (process.platform === "win32") {
    return null;
  }

  const shell = basename(process.env.SHELL || "");
  if (shell === "zsh") {
    return join(homedir(), ".zshrc");
  }
  if (shell === "bash") {
    return process.platform === "darwin"
      ? join(homedir(), ".bash_profile")
      : join(homedir(), ".bashrc");
  }
  if (shell === "fish") {
    return join(homedir(), ".config", "fish", "config.fish");
  }
  return null;
}

function ensureShellPathEntry(profilePath: string) {
  ensureDir(dirname(profilePath));
  const exportLine = shellPathExportLine();
  const contents = existsSync(profilePath) ? readFileSync(profilePath, "utf8") : "";

  if (contents.includes(exportLine) || contents.includes(SHOWPANE_BIN_DIR)) {
    return false;
  }

  const prefix = contents.length > 0 && !contents.endsWith("\n") ? "\n" : "";
  writeFileSync(profilePath, `${contents}${prefix}${exportLine}\n`);
  return true;
}

type PathSetupResult = {
  command: string;
  configured: boolean;
  profilePath: string | null;
};

async function maybeConfigureShellPath(config: ShowpaneConfig, options: CreateOptions): Promise<PathSetupResult> {
  const configuredProfile =
    typeof config.shellPathConfiguredProfile === "string"
      ? config.shellPathConfiguredProfile
      : null;

  if (isShowpaneShimOnPath()) {
    config.shellPathConfigured = true;
    config.shellPathPrompted = true;
    return {
      command: "showpane claude",
      configured: true,
      profilePath: configuredProfile,
    };
  }

  if (config.shellPathConfigured) {
    return {
      command: "showpane claude",
      configured: true,
      profilePath: configuredProfile,
    };
  }

  if (options.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    config.shellPathPrompted = true;
    config.shellPathConfigured = false;
    return {
      command: "npx showpane claude",
      configured: false,
      profilePath: configuredProfile,
    };
  }

  const profilePath = detectShellProfile();
  if (!profilePath) {
    config.shellPathPrompted = true;
    config.shellPathConfigured = false;
    return {
      command: "npx showpane claude",
      configured: false,
      profilePath: null,
    };
  }

  const answer = await ask(
    `  ${BOLD}Add Showpane to your PATH so 'showpane' works in future terminals?${RESET} ${DIM}(recommended) [Y/n]${RESET} `
  );

  if (answer && !["y", "yes"].includes(answer.toLowerCase())) {
    config.shellPathPrompted = true;
    config.shellPathConfigured = false;
    config.shellPathConfiguredProfile = profilePath;
    return {
      command: "npx showpane claude",
      configured: false,
      profilePath,
    };
  }

  ensureShellPathEntry(profilePath);
  config.shellPathPrompted = true;
  config.shellPathConfigured = true;
  config.shellPathConfiguredProfile = profilePath;

  console.log();
  green(`Added Showpane to your PATH in ${DIM}${profilePath}${RESET}`);

  return {
    command: "showpane claude",
    configured: true,
    profilePath,
  };
}

function getCommandOutput(errorLike: unknown) {
  const error = errorLike as {
    stdout?: Buffer | string;
    stderr?: Buffer | string;
    message?: string;
  };

  const stdout = typeof error?.stdout === "string"
    ? error.stdout
    : error?.stdout?.toString() ?? "";
  const stderr = typeof error?.stderr === "string"
    ? error.stderr
    : error?.stderr?.toString() ?? "";

  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

function runQuiet(command: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  try {
    execSync(command, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (errorLike) {
    const output = getCommandOutput(errorLike);
    throw new StepCommandError(
      errorLike instanceof Error ? errorLike.message : String(errorLike),
      output
    );
  }
}

async function runQuietAsync(command: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  const child = spawn(command, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  const appendOutput = (chunk: Buffer | string) => {
    output += chunk.toString();
    if (output.length > 20 * 1024 * 1024) {
      output = output.slice(-20 * 1024 * 1024);
    }
  };

  child.stdout?.on("data", appendOutput);
  child.stderr?.on("data", appendOutput);

  await new Promise<void>((resolvePromise, rejectPromise) => {
    child.on("error", (errorLike) => {
      rejectPromise(
        new StepCommandError(
          errorLike instanceof Error ? errorLike.message : String(errorLike),
          output.trim(),
        ),
      );
    });

    child.on("close", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const reason = signal
        ? `Command terminated with signal ${signal}`
        : `Command exited with code ${code ?? "unknown"}`;

      rejectPromise(new StepCommandError(reason, output.trim()));
    });
  });
}

async function runInstallerCommand(command: string, cwd: string, env: NodeJS.ProcessEnv, verbose: boolean) {
  if (verbose) {
    run(command, cwd, env);
    return;
  }

  await runQuietAsync(command, cwd, env);
}

let activeSpinner: StepSpinner | null = null;

function renderSpinner(label: string, frame: string, startedAt: number) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const elapsed = elapsedSeconds > 0 ? ` ${DIM}${elapsedSeconds}s${RESET}` : "";
  process.stdout.write(`\r  ${BLUE}${frame}${RESET} ${label}...${elapsed}\x1b[K`);
}

function stopSpinner(clearLine = true) {
  if (!activeSpinner) return;
  clearInterval(activeSpinner.interval);
  if (clearLine) {
    process.stdout.write("\r\x1b[K");
  } else {
    process.stdout.write("\n");
  }
  activeSpinner = null;
}

function stepStart(label: string, spinner = false) {
  stopSpinner();
  if (!spinner) {
    blue(label);
    return;
  }

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frameIndex = 0;
  const startedAt = Date.now();
  renderSpinner(label, frames[frameIndex], startedAt);
  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    renderSpinner(label, frames[frameIndex], startedAt);
  }, 80);

  activeSpinner = {
    interval,
    label,
    startedAt,
  };
}

function stepSuccess(label: string) {
  stopSpinner();
  green(label);
}

function stepFailure(label: string, errorLike: unknown, hint?: string): never {
  stopSpinner();
  error(`${label} failed.`);
 
  const message = errorLike instanceof Error ? errorLike.message : String(errorLike);
  const output =
    errorLike instanceof StepCommandError
      ? errorLike.output
      : getCommandOutput(errorLike);

  if (output) {
    console.error();
    console.error(output.trimEnd());
  } else if (message) {
    console.error();
    console.error(message.trim());
  }

  if (hint) {
    console.error();
    console.error(`Hint: ${hint}`);
  }

  process.exit(1);
}

function shouldUseSpinner(verbose: boolean) {
  return process.stdout.isTTY && !verbose;
}

function stepStartForCreate(label: string, options: CreateOptions) {
  stepStart(label, shouldUseSpinner(options.verbose));
}

function stepSuccessForCreate(label: string) {
  stepSuccess(label);
}

function stepFailureForCreate(label: string, errorLike: unknown, hint?: string): never {
  stepFailure(label, errorLike, hint);
}

function attachSpinnerCleanup() {
  const cleanup = () => stopSpinner();
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

attachSpinnerCleanup();

function stepStartPlain(label: string) {
  blue(label);
}

function openBrowser(url: string) {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? "open"
      : platform === "win32"
        ? "start"
        : "xdg-open";

  execSync(`${command} ${JSON.stringify(url)}`, { stdio: "ignore" });
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getShowpaneConfigPath() {
  return join(SHOWPANE_HOME, "config.json");
}

function readShowpaneConfig(): ShowpaneConfig {
  const configPath = getShowpaneConfigPath();
  if (!existsSync(configPath)) {
    return {};
  }
  return readJson<ShowpaneConfig>(configPath);
}

function writeShowpaneConfig(config: ShowpaneConfig) {
  ensureDir(SHOWPANE_HOME);
  const configPath = getShowpaneConfigPath();
  writeJson(configPath, config);
  chmodSync(configPath, 0o600);
}

function findWorkspaceRoot(startPath: string) {
  let currentPath = resolve(startPath);

  while (true) {
    if (
      existsSync(join(currentPath, "package.json")) &&
      existsSync(join(currentPath, "prisma", "schema.prisma")) &&
      existsSync(getProjectMetadataPath(currentPath))
    ) {
      return currentPath;
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }
    currentPath = parentPath;
  }
}

function defaultWorkspaceEntry(projectPath: string, overrides?: Partial<WorkspaceEntry>): WorkspaceEntry {
  return {
    name: basename(projectPath),
    path: resolve(projectPath),
    lastUsedAt: new Date().toISOString(),
    deployMode: "local",
    orgSlug: "",
    ...overrides,
  };
}

function getWorkspaceEntries(config: ShowpaneConfig) {
  const workspaces = [...(config.workspaces ?? [])];
  const activePath = config.app_path ? resolve(config.app_path) : null;

  if (activePath && !workspaces.some((workspace) => normalizePathForComparison(workspace.path) === normalizePathForComparison(activePath))) {
    workspaces.push(defaultWorkspaceEntry(activePath, {
      deployMode: typeof config.deploy_mode === "string" ? config.deploy_mode : "local",
      orgSlug: typeof config.orgSlug === "string" ? config.orgSlug : "",
    }));
  }

  return workspaces
    .map((workspace) => ({
      ...workspace,
      path: resolve(workspace.path),
      lastUsedAt: workspace.lastUsedAt || new Date(0).toISOString(),
      deployMode: workspace.deployMode || "local",
      orgSlug: workspace.orgSlug || "",
    }))
    .sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
}

function setActiveWorkspace(config: ShowpaneConfig, workspace: WorkspaceEntry) {
  config.app_path = workspace.path;
  config.deploy_mode = workspace.deployMode;
  config.orgSlug = workspace.orgSlug;
}

function upsertWorkspace(config: ShowpaneConfig, workspace: WorkspaceEntry, makeActive = true) {
  const workspaces = getWorkspaceEntries(config).filter((entry) =>
    normalizePathForComparison(entry.path) !== normalizePathForComparison(workspace.path)
  );
  workspaces.push(workspace);
  config.workspaces = workspaces.sort((left, right) => right.lastUsedAt.localeCompare(left.lastUsedAt));
  if (makeActive) {
    setActiveWorkspace(config, workspace);
  }
}

function updateWorkspaceFromConfig(config: ShowpaneConfig, projectPath: string, overrides?: Partial<WorkspaceEntry>) {
  const workspace = defaultWorkspaceEntry(projectPath, {
    deployMode: typeof config.deploy_mode === "string" ? config.deploy_mode : "local",
    orgSlug: typeof config.orgSlug === "string" ? config.orgSlug : "",
    ...overrides,
  });
  upsertWorkspace(config, workspace, true);
  return workspace;
}

function ensureShowpaneShim() {
  ensureDir(SHOWPANE_BIN_DIR);

  const shellShim = join(SHOWPANE_BIN_DIR, "showpane");
  writeFileSync(
    shellShim,
    "#!/bin/sh\nexec npx --yes showpane \"$@\"\n"
  );
  chmodSync(shellShim, 0o755);

  if (process.platform === "win32") {
    writeFileSync(
      join(SHOWPANE_BIN_DIR, "showpane.cmd"),
      "@echo off\r\nnpx --yes showpane %*\r\n"
    );
  }
}

function ensureDir(dirPath: string) {
  mkdirSync(dirPath, { recursive: true });
}

function removePath(targetPath: string) {
  if (!existsSync(targetPath)) return;

  const stat = lstatSync(targetPath);
  if (stat.isSymbolicLink() || stat.isFile()) {
    unlinkSync(targetPath);
    return;
  }

  rmSync(targetPath, { recursive: true, force: true });
}

function copyDirContents(sourceDir: string, targetDir: string) {
  ensureDir(targetDir);
  for (const entry of readdirSync(sourceDir)) {
    cpSync(join(sourceDir, entry), join(targetDir, entry), { recursive: true });
  }
}

function getBundledScaffoldPath(scaffoldRoot: string, relativePath: string) {
  const baseName = path.basename(relativePath);
  const bundledBaseName = baseName.startsWith(".")
    ? `__dot__${baseName.slice(1)}`
    : baseName;
  return join(scaffoldRoot, dirname(relativePath), bundledBaseName);
}

function copyScaffoldFiles(scaffoldRoot: string, projectRoot: string, manifest: ScaffoldManifest) {
  for (const relativePath of Object.keys(manifest.files)) {
    const sourcePath = getBundledScaffoldPath(scaffoldRoot, relativePath);
    const targetPath = join(projectRoot, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath);
  }
}

function hashFile(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function getPathSignature(filePath: string) {
  if (!existsSync(filePath)) return null;

  const stat = lstatSync(filePath);
  if (!stat.isFile()) {
    return "__NON_FILE__";
  }

  return hashFile(filePath);
}

function commandExists(command: string) {
  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      execSync(`command -v ${command}`, { stdio: "ignore", shell: "/bin/zsh" });
    }
    return true;
  } catch {
    return false;
  }
}

function findFreePort(startPort: number): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.listen(startPort, () => {
      server.close(() => resolvePort(startPort));
    });
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolvePort(findFreePort(startPort + 1));
      } else {
        rejectPort(err);
      }
    });
  });
}

function getPackageRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

function getPackageVersion(packageRoot: string) {
  const packageJson = readJson<{ version: string }>(join(packageRoot, "package.json"));
  return packageJson.version;
}

function getLocalBundleRoot(packageRoot: string) {
  const bundleRoot = join(packageRoot, "bundle");
  if (!existsSync(join(bundleRoot, "scaffold")) || !existsSync(join(bundleRoot, "toolchain"))) {
    throw new Error("CLI bundle assets are missing. Run `npm run build` before using the local package.");
  }
  return bundleRoot;
}

function getScaffoldManifest(bundleRoot: string) {
  return readJson<ScaffoldManifest>(join(bundleRoot, "meta", "scaffold-manifest.json"));
}

function getToolchainVersion(bundleRoot: string) {
  return readFileSync(join(bundleRoot, "toolchain", "VERSION"), "utf8").trim();
}

function getManagedFilesPath(projectRoot: string) {
  return join(projectRoot, METADATA_DIRNAME, MANAGED_FILES_FILE);
}

function getProjectMetadataPath(projectRoot: string) {
  return join(projectRoot, METADATA_DIRNAME, PROJECT_METADATA_FILE);
}

function writeProjectState(projectRoot: string, showpaneVersion: string, scaffoldManifest: ScaffoldManifest, toolchainVersion: string) {
  const timestamp = new Date().toISOString();
  const projectMetadata: ProjectMetadata = {
    schemaVersion: 1,
    showpaneVersion,
    scaffoldVersion: scaffoldManifest.scaffoldVersion,
    toolchainVersion,
    projectRoot,
    installedAt: timestamp,
    lastUpgradedAt: timestamp,
  };

  writeJson(getProjectMetadataPath(projectRoot), projectMetadata);
  writeJson(getManagedFilesPath(projectRoot), {
    schemaVersion: 1,
    showpaneVersion,
    scaffoldVersion: scaffoldManifest.scaffoldVersion,
    files: scaffoldManifest.files,
  });
}

function readManagedFiles(projectRoot: string) {
  return readJson<{ schemaVersion: number; showpaneVersion: string; scaffoldVersion: string; files: ManifestFiles }>(
    getManagedFilesPath(projectRoot)
  );
}

function readProjectMetadata(projectRoot: string) {
  return readJson<ProjectMetadata>(getProjectMetadataPath(projectRoot));
}

function writeUpdatedProjectState(projectRoot: string, previousMetadata: ProjectMetadata, showpaneVersion: string, scaffoldManifest: ScaffoldManifest, toolchainVersion: string) {
  writeJson(getProjectMetadataPath(projectRoot), {
    ...previousMetadata,
    showpaneVersion,
    scaffoldVersion: scaffoldManifest.scaffoldVersion,
    toolchainVersion,
    lastUpgradedAt: new Date().toISOString(),
  });

  writeJson(getManagedFilesPath(projectRoot), {
    schemaVersion: 1,
    showpaneVersion,
    scaffoldVersion: scaffoldManifest.scaffoldVersion,
    files: scaffoldManifest.files,
  });
}

function detectProjectRoot(explicitProjectPath?: string) {
  const candidatePaths = [
    explicitProjectPath ? resolve(explicitProjectPath) : null,
    resolve(process.cwd()),
    resolve(process.cwd(), "app"),
  ].filter(Boolean) as string[];

  const configPath = join(SHOWPANE_HOME, "config.json");
  if (existsSync(configPath)) {
    const config = readJson<{ app_path?: string }>(configPath);
    if (config.app_path) {
      candidatePaths.push(resolve(config.app_path));
    }
  }

  for (const candidate of candidatePaths) {
    if (
      existsSync(join(candidate, "package.json")) &&
      existsSync(join(candidate, "prisma", "schema.prisma")) &&
      existsSync(getProjectMetadataPath(candidate)) &&
      existsSync(getManagedFilesPath(candidate))
    ) {
      return candidate;
    }
  }

  throw new Error("Could not find a Showpane project root. Run the command from the project directory or pass --project <path>.");
}

function parseEnvFile(filePath: string) {
  const env: Record<string, string> = {};
  if (!existsSync(filePath)) return env;

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function safeRelative(basePath: string, filePath: string) {
  return path.relative(basePath, filePath).split(path.sep).join("/");
}

function cleanupEmptyParents(projectRoot: string, relativePath: string) {
  let currentDir = dirname(join(projectRoot, relativePath));
  while (currentDir.startsWith(projectRoot) && currentDir !== projectRoot) {
    if (readdirSync(currentDir).length > 0) break;
    rmSync(currentDir, { recursive: true, force: true });
    currentDir = dirname(currentDir);
  }
}

function buildUpgradePlan(projectRoot: string, currentManifest: ManifestFiles, targetManifest: ManifestFiles) {
  const plan: UpgradePlan = {
    additions: [],
    updates: [],
    deletions: [],
    conflicts: [],
  };

  const allPaths = new Set<string>([
    ...Object.keys(currentManifest),
    ...Object.keys(targetManifest),
  ]);

  for (const relativePath of [...allPaths].sort()) {
    const currentRecordedHash = currentManifest[relativePath];
    const targetHash = targetManifest[relativePath];
    const absolutePath = join(projectRoot, relativePath);
    const currentHash = getPathSignature(absolutePath);
    const existsNow = currentHash !== null;

    const locallyModifiedManagedFile =
      currentRecordedHash !== undefined && currentHash !== currentRecordedHash;
    const collidingUnmanagedFile =
      currentRecordedHash === undefined &&
      targetHash !== undefined &&
      existsNow &&
      currentHash !== targetHash;

    if (locallyModifiedManagedFile || collidingUnmanagedFile) {
      plan.conflicts.push(relativePath);
      continue;
    }

    if (targetHash === undefined) {
      if (existsNow) {
        plan.deletions.push(relativePath);
      }
      continue;
    }

    if (!existsNow) {
      plan.additions.push(relativePath);
      continue;
    }

    if (currentHash !== targetHash) {
      plan.updates.push(relativePath);
    }
  }

  return plan;
}

function applyUpgradePlan(projectRoot: string, scaffoldSource: string, plan: UpgradePlan) {
  for (const relativePath of plan.deletions) {
    removePath(join(projectRoot, relativePath));
    cleanupEmptyParents(projectRoot, relativePath);
  }

  for (const relativePath of [...plan.additions, ...plan.updates]) {
    const sourcePath = getBundledScaffoldPath(scaffoldSource, relativePath);
    const targetPath = join(projectRoot, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(sourcePath, targetPath);
  }
}

async function installDependencies(projectRoot: string, verbose?: boolean) {
  if (existsSync(join(projectRoot, "package-lock.json"))) {
    if (verbose === undefined) {
      run("npm ci", projectRoot, getInstallerEnv());
    } else {
      await runInstallerCommand("npm ci", projectRoot, getInstallerEnv(), verbose);
    }
  } else {
    if (verbose === undefined) {
      run("npm install", projectRoot, getInstallerEnv());
    } else {
      await runInstallerCommand("npm install", projectRoot, getInstallerEnv(), verbose);
    }
  }
}

async function generateLocalDatabase(projectRoot: string, databaseUrl: string, verbose?: boolean) {
  const env = getInstallerEnv({
    DATABASE_URL: databaseUrl,
  });
  if (verbose === undefined) {
    run("npm run prisma:db-push", projectRoot, env);
  } else {
    await runInstallerCommand("npm run prisma:db-push", projectRoot, env, verbose);
  }
}

async function seedProject(projectRoot: string, databaseUrl: string, verbose?: boolean) {
  const env = getInstallerEnv({
    DATABASE_URL: databaseUrl,
  });
  if (verbose === undefined) {
    run("npx tsx prisma/seed.ts", projectRoot, env);
  } else {
    await runInstallerCommand("npx tsx prisma/seed.ts", projectRoot, env, verbose);
  }
}

function maybeRunPostUpgradeSteps(projectRoot: string, changedPaths: string[]) {
  const dependenciesChanged = changedPaths.some((relativePath) =>
    ["package.json", "package-lock.json"].includes(relativePath)
  );

  const prismaChanged = changedPaths.some((relativePath) => relativePath.startsWith("prisma/"));

  if (dependenciesChanged) {
    blue("Refreshing project dependencies");
    installDependencies(projectRoot);
  }

  if (prismaChanged) {
    const env = parseEnvFile(join(projectRoot, ".env"));
    if (env.DATABASE_URL?.startsWith("file:")) {
      blue("Applying local SQLite schema updates");
      run("npm run prisma:db-push", projectRoot, getInstallerEnv({
        DATABASE_URL: env.DATABASE_URL,
      }));
    } else {
      blue("Refreshing Prisma client");
      run("npm run prisma:generate", projectRoot, getInstallerEnv());
    }
  }
}

function tryInitializeGitRepo(projectRoot: string, announce = true) {
  if (!commandExists("git")) {
    blue("Git not found; skipped repository initialization");
    return;
  }

  try {
    execSync("git init -q -b main", { cwd: projectRoot, stdio: "ignore" });
  } catch {
    execSync("git init -q", { cwd: projectRoot, stdio: "ignore" });
    try {
      execSync("git branch -M main", { cwd: projectRoot, stdio: "ignore" });
    } catch {
      // Ignore branch rename issues on older git.
    }
  }

  try {
    run("git add .", projectRoot);
    execSync('git commit -m "Initial Showpane scaffold"', {
      cwd: projectRoot,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Showpane",
        GIT_AUTHOR_EMAIL: "showpane@local.invalid",
        GIT_COMMITTER_NAME: "Showpane",
        GIT_COMMITTER_EMAIL: "showpane@local.invalid",
      },
    });
    if (announce) {
      green("Git repository initialized");
    }
  } catch {
    if (announce) {
      blue("Initialized git repository without an initial commit");
    }
  }
}

function installSharedSkillProjection(toolchainRoot: string) {
  const sharedSource = join(toolchainRoot, "skills", "shared");
  const sharedTarget = join(CLAUDE_SKILLS_DIR, SHOWPANE_SHARED_SKILL);
  removePath(sharedTarget);
  symlinkSync(
    sharedSource,
    sharedTarget,
    process.platform === "win32" ? "junction" : "dir"
  );
}

function printCreateSuccessCard(projectRoot: string, url: string, pathSetup: PathSetupResult) {
  const resumeCommand = pathSetup.command;
  console.log();
  console.log(`  ${GREEN}Showpane is ready${RESET}`);
  console.log();
  console.log(`  ${BOLD}Project:${RESET} ${projectRoot}`);
  console.log(`  ${BOLD}App:${RESET}     ${url}`);
  console.log(`  ${BOLD}Demo:${RESET}    example / demo-only-password`);
  console.log();
  console.log(`  ${BOLD}Next (in a new terminal window):${RESET}`);
  console.log(`    ${DIM}${resumeCommand}${RESET}`);
  console.log();
  if (pathSetup.configured && pathSetup.profilePath) {
    console.log(`  ${DIM}Your current terminal is running the local app logs. Open a fresh terminal so ${BOLD}showpane${RESET}${DIM} is available from ${pathSetup.profilePath}.${RESET}`);
  } else {
    console.log(`  ${DIM}Your current terminal is running the local app logs, so open a fresh terminal before you run that command.${RESET}`);
  }
  console.log();
  console.log(`  ${BOLD}Try:${RESET}`);
  console.log(`    ${DIM}Create a portal for my call with Acme Health${RESET}`);
  if (!pathSetup.configured) {
    console.log();
    console.log(`  ${DIM}${getResumeHint()}${RESET}`);
  }
  console.log();
}

type DevServerStart = {
  devServer: ReturnType<typeof spawn>;
  url: string;
};

type ClaudeWorkspaceSelection =
  | { mode: "create" }
  | { mode: "open"; workspace: WorkspaceEntry };

function startDevServer(
  projectRoot: string,
  databaseUrl: string,
  noOpen: boolean,
  verbose: boolean,
): Promise<DevServerStart> {
  return new Promise(async (resolveStart, rejectStart) => {
    const port = await findFreePort(3000);
    const url = `http://localhost:${port}`;
    const devServer = spawn("npm", ["run", "dev"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: String(port), DATABASE_URL: databaseUrl },
    });

    let ready = false;
    let bufferedOutput = "";
    const readyPattern = /ready in/i;

    const handleChunk = (target: NodeJS.WriteStream) => (chunk: Buffer) => {
      const text = chunk.toString();

      if (verbose) {
        target.write(text);
      } else if (ready) {
        target.write(text);
      } else {
        bufferedOutput += text;
        if (bufferedOutput.length > 100_000) {
          bufferedOutput = bufferedOutput.slice(-100_000);
        }
      }

      if (!ready && readyPattern.test(text)) {
        ready = true;
        stepSuccess("Start app");
        if (!noOpen) {
          blue(`Opening ${url}`);
          try {
            openBrowser(url);
          } catch {
            // Ignore browser-launch issues.
          }
        }
        resolveStart({ devServer, url });
      }
    };

    devServer.stdout?.on("data", handleChunk(process.stdout));
    devServer.stderr?.on("data", handleChunk(process.stderr));
    devServer.on("error", (errorLike) => {
      rejectStart(new StepCommandError(
        errorLike instanceof Error ? errorLike.message : String(errorLike),
        bufferedOutput.trim(),
      ));
    });
    devServer.on("close", (code) => {
      if (ready) {
        return;
      }

      const message = code === null
        ? "Dev server exited before becoming ready."
        : `Dev server exited with code ${code} before becoming ready.`;

      rejectStart(new StepCommandError(message, bufferedOutput.trim()));
    });
  });
}

function resolveWorkspaceSelection(config: ShowpaneConfig, specifier?: string) {
  const workspaces = getWorkspaceEntries(config);

  if (!specifier) {
    return workspaces;
  }

  const asPathRoot = findWorkspaceRoot(specifier);
  if (asPathRoot) {
    return [defaultWorkspaceEntry(asPathRoot)];
  }

  const normalizedSpecifier = normalizePathForComparison(specifier);
  const pathMatches = workspaces.filter((workspace) =>
    normalizePathForComparison(workspace.path) === normalizedSpecifier
  );
  if (pathMatches.length > 0) {
    return pathMatches;
  }

  const nameMatches = workspaces.filter((workspace) => workspace.name === specifier);
  return nameMatches;
}

async function promptWorkspaceSelection(workspaces: WorkspaceEntry[]) {
  console.log();
  console.log(`  ${BOLD}Select a Showpane workspace${RESET}`);
  console.log();

  for (const [index, workspace] of workspaces.entries()) {
    console.log(`  ${index + 1}. ${workspace.name}`);
    console.log(`     ${DIM}${workspace.path}${RESET}`);
    console.log(`     ${DIM}Last used: ${workspace.lastUsedAt}${RESET}`);
  }

  console.log();
  while (true) {
    const answer = await ask(`  ${BOLD}Choose a workspace [1-${workspaces.length}] or q to cancel:${RESET} `);
    if (!answer) continue;
    if (answer.toLowerCase() === "q") {
      process.exit(0);
    }

    const selectedIndex = Number.parseInt(answer, 10);
    if (Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= workspaces.length) {
      return workspaces[selectedIndex - 1];
    }
  }
}

function printWorkspaceList(config: ShowpaneConfig) {
  printBanner();
  const workspaces = getWorkspaceEntries(config);

  if (workspaces.length === 0) {
    console.log();
    blue("No Showpane workspaces found");
    console.log(`  ${DIM}Run: npx showpane${RESET}`);
    console.log();
    return;
  }

  const activePath = config.app_path ? normalizePathForComparison(config.app_path) : null;
  console.log();
  console.log(`  ${BOLD}Showpane workspaces${RESET}`);
  console.log();

  for (const [index, workspace] of workspaces.entries()) {
    const isActive = activePath !== null && normalizePathForComparison(workspace.path) === activePath;
    const marker = isActive ? "*" : " ";
    console.log(`  ${marker} ${index + 1}. ${workspace.name}`);
    console.log(`     ${workspace.path}`);
    console.log(`     ${DIM}Last used: ${workspace.lastUsedAt}${RESET}`);
  }
  console.log();
}

async function openClaudeInWorkspace(workspace: WorkspaceEntry) {
  if (!commandExists("claude")) {
    throw new Error("Claude Code is not installed or not on PATH.");
  }

  blue(`Opening ${workspace.name} workspace`);
  console.log(`  ${DIM}${workspace.path}${RESET}`);
  console.log();

  await new Promise<void>((resolveLaunch, rejectLaunch) => {
    const child = spawn("claude", [], {
      cwd: workspace.path,
      stdio: "inherit",
      env: {
        ...process.env,
        SHOWPANE_APP_PATH: workspace.path,
        SHOWPANE_TOOLCHAIN_DIR: CURRENT_TOOLCHAIN_LINK,
      },
    });

    child.on("error", rejectLaunch);
    child.on("close", (code) => {
      process.exit(code ?? 0);
    });
  });
}

function installSkillProjection(toolchainRoot: string) {
  removePath(join(CLAUDE_SKILLS_DIR, "showpane"));
  installSharedSkillProjection(toolchainRoot);

  const installedSkills: string[] = [];
  const skillsRoot = join(toolchainRoot, "skills");
  const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("portal-"));

  for (const skillDir of skillDirs) {
    const skillMdPath = join(skillsRoot, skillDir.name, "SKILL.md");
    if (!existsSync(skillMdPath)) continue;

    const skillNameMatch = readFileSync(skillMdPath, "utf8").match(/^name:\s*(.+)$/m);
    const skillName = skillNameMatch?.[1]?.trim() || skillDir.name;
    const targetDir = join(CLAUDE_SKILLS_DIR, skillName);
    removePath(targetDir);
    mkdirSync(targetDir, { recursive: true });
    symlinkSync(skillMdPath, join(targetDir, "SKILL.md"));
    installedSkills.push(skillName);
  }

  return installedSkills;
}

function syncToolchain(bundleRoot: string, showpaneVersion: string, announce = true) {
  const sourceToolchain = join(bundleRoot, "toolchain");
  const targetToolchain = join(TOOLCHAIN_DIR, showpaneVersion);

  ensureDir(TOOLCHAIN_DIR);
  ensureDir(SHOWPANE_HOME);
  ensureDir(CLAUDE_SKILLS_DIR);

  removePath(targetToolchain);
  copyDirContents(sourceToolchain, targetToolchain);

  const helperBinDir = join(SHOWPANE_HOME, "bin");
  ensureDir(helperBinDir);
  removePath(join(helperBinDir, "showpane-config"));
  symlinkSync(
    join(targetToolchain, "bin", "showpane-config"),
    join(helperBinDir, "showpane-config")
  );

  removePath(CURRENT_TOOLCHAIN_LINK);
  symlinkSync(
    targetToolchain,
    CURRENT_TOOLCHAIN_LINK,
    process.platform === "win32" ? "junction" : "dir"
  );

  const installedSkills = installSkillProjection(targetToolchain);
  if (announce) {
    green(`Toolchain synced to v${showpaneVersion}`);
    green(`${installedSkills.length} Claude Code skills installed`);
  }

  return {
    installedSkills,
    toolchainRoot: targetToolchain,
    toolchainVersion: getToolchainVersion(bundleRoot),
  };
}

function extractBundleForVersion(version: string) {
  const tempRoot = fs.mkdtempSync(join(os.tmpdir(), "showpane-upgrade-"));
  const packResult = capture(`npm pack showpane@${version} --json`, tempRoot);
  const packJson = JSON.parse(packResult) as Array<{ filename: string }>;
  const tarballName = packJson.at(-1)?.filename;

  if (!tarballName) {
    throw new Error(`Could not download showpane@${version}`);
  }

  run(
    `tar -xzf ${JSON.stringify(join(tempRoot, tarballName))} -C ${JSON.stringify(tempRoot)}`,
    tempRoot
  );

  return {
    bundleRoot: join(tempRoot, "package", "bundle"),
    cleanup() {
      rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

async function createProject(args: string[]) {
  const packageRoot = getPackageRoot();
  const bundleRoot = getLocalBundleRoot(packageRoot);
  const showpaneVersion = getPackageVersion(packageRoot);
  const scaffoldManifest = getScaffoldManifest(bundleRoot);
  let options: CreateOptions;

  try {
    options = parseCreateArgs(args);
  } catch (errorLike) {
    printBanner();
    console.log();
    error(errorLike instanceof Error ? errorLike.message : String(errorLike));
    printCreateUsage();
    process.exit(1);
  }

  printBanner();
  ensureShowpaneShim();
  const config = readShowpaneConfig();
  let pathSetup: PathSetupResult = {
    command: getResumeCommand(),
    configured: isShowpaneShimOnPath() || Boolean(config.shellPathConfigured),
    profilePath:
      typeof config.shellPathConfiguredProfile === "string"
        ? config.shellPathConfiguredProfile
        : null,
  };

  const companyName = options.companyName ?? await ask(`  ${BOLD}What's your company name?${RESET} `);
  if (!companyName) {
    error("Company name is required.");
    process.exit(1);
  }

  const slug = toSlug(companyName);
  const dirName = `showpane-${slug}`;
  const projectRoot = resolve(process.cwd(), dirName);

  if (existsSync(projectRoot)) {
    error(`Target directory already exists: ${dirName}/`);
    process.exit(1);
  }

  console.log();
  blue(`Setting up ${BOLD}${companyName}${RESET} portal as ${DIM}${dirName}/${RESET}`);
  console.log();

  stepStartForCreate("Creating project", options);
  try {
    copyScaffoldFiles(join(bundleRoot, "scaffold"), projectRoot, scaffoldManifest);
    stepSuccessForCreate("Project created");
  } catch (errorLike) {
    stepFailureForCreate("Creating project", errorLike);
  }

  stepStartForCreate("Installing dependencies", options);
  try {
    await installDependencies(projectRoot, options.verbose);
    stepSuccessForCreate("Dependencies installed");
  } catch (errorLike) {
    stepFailureForCreate(
      "Installing dependencies",
      errorLike,
      "Check your Node.js version and network connection, then try again."
    );
  }

  const authSecret = randomBytes(32).toString("hex");
  const databaseUrl = "file:./dev.db";
  writeFileSync(
    join(projectRoot, ".env"),
    `DATABASE_URL="${databaseUrl}"\nAUTH_SECRET="${authSecret}"\n`
  );

  stepStartForCreate("Configuring database", options);
  try {
    await generateLocalDatabase(projectRoot, databaseUrl, options.verbose);
    await seedProject(projectRoot, databaseUrl, options.verbose);
    stepSuccessForCreate("Database configured");
  } catch (errorLike) {
    stepFailureForCreate(
      "Configuring database",
      errorLike,
      "Check Prisma setup and the generated .env file, then retry the install."
    );
  }

  stepStartForCreate("Installing Claude skills", options);
  let toolchainInfo: ReturnType<typeof syncToolchain>;
  try {
    toolchainInfo = syncToolchain(bundleRoot, showpaneVersion, false);
    updateWorkspaceFromConfig(config, projectRoot, {
      name: dirName,
      deployMode: "local",
      orgSlug: "",
    });
    pathSetup = await maybeConfigureShellPath(config, options);
    writeShowpaneConfig(config);
    writeProjectState(
      projectRoot,
      showpaneVersion,
      scaffoldManifest,
      toolchainInfo.toolchainVersion
    );
    tryInitializeGitRepo(projectRoot, false);
    stepSuccessForCreate("Claude skills installed");
  } catch (errorLike) {
    stepFailureForCreate(
      "Installing Claude skills",
      errorLike,
      "Check permissions for ~/.showpane and ~/.claude/skills, then try again."
    );
  }

  stepStartForCreate("Starting app", options);
  let serverStart: DevServerStart;
  try {
    serverStart = await startDevServer(
      projectRoot,
      databaseUrl,
      options.noOpen,
      options.verbose,
    );
  } catch (errorLike) {
    stepFailureForCreate(
      "Starting app",
      errorLike,
      `Run ${BOLD}cd ${dirName} && npm run dev${RESET} for more detail.`
    );
  }

  printCreateSuccessCard(projectRoot, serverStart.url, pathSetup);

  serverStart.devServer.on("close", (code) => {
    if (code !== 0) {
      error(`Dev server exited with code ${code}`);
    }
    process.exit(code ?? 1);
  });

  process.on("SIGINT", () => {
    serverStart.devServer.kill("SIGINT");
  });
  process.on("SIGTERM", () => {
    serverStart.devServer.kill("SIGTERM");
  });
}

async function syncCurrentToolchain() {
  const packageRoot = getPackageRoot();
  const bundleRoot = getLocalBundleRoot(packageRoot);
  const showpaneVersion = getPackageVersion(packageRoot);

  ensureShowpaneShim();
  printBanner();
  maybePrintShowpaneUpdateMessage(showpaneVersion);
  console.log();
  blue(`Syncing Showpane toolchain v${showpaneVersion}`);
  console.log();

  syncToolchain(bundleRoot, showpaneVersion);
}

function parseUpgradeArgs(args: string[]) {
  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };

  return {
    targetVersion: getArg("--to"),
    projectPath: getArg("--project"),
    dryRun: args.includes("--dry-run"),
  };
}

async function upgradeProject(args: string[]) {
  const packageRoot = getPackageRoot();
  const currentCliVersion = getPackageVersion(packageRoot);
  const { targetVersion, projectPath, dryRun } = parseUpgradeArgs(args);
  const resolvedTargetVersion = targetVersion || currentCliVersion;
  const projectRoot = detectProjectRoot(projectPath);

  printBanner();
  maybePrintShowpaneUpdateMessage(currentCliVersion);
  console.log();
  blue(`Preparing upgrade for ${DIM}${projectRoot}${RESET}`);
  console.log();

  const bundleSource =
    resolvedTargetVersion === currentCliVersion
      ? { bundleRoot: getLocalBundleRoot(packageRoot), cleanup() {} }
      : extractBundleForVersion(resolvedTargetVersion);

  try {
    const targetBundleRoot = bundleSource.bundleRoot;
    const scaffoldManifest = getScaffoldManifest(targetBundleRoot);
    const currentManagedFiles = readManagedFiles(projectRoot).files;
    const projectMetadata = readProjectMetadata(projectRoot);
    const plan = buildUpgradePlan(projectRoot, currentManagedFiles, scaffoldManifest.files);

    if (plan.conflicts.length > 0) {
      error(`Upgrade blocked by ${plan.conflicts.length} modified managed file(s).`);
      for (const relativePath of plan.conflicts) {
        console.error(`    ${relativePath}`);
      }
      process.exit(1);
    }

    console.log(`  Additions: ${plan.additions.length}`);
    console.log(`  Updates:   ${plan.updates.length}`);
    console.log(`  Deletions: ${plan.deletions.length}`);
    console.log(`  Conflicts: ${plan.conflicts.length}`);
    console.log();

    if (dryRun) {
      green(`Dry run complete for showpane@${resolvedTargetVersion}`);
      process.exit(0);
    }

    applyUpgradePlan(projectRoot, join(targetBundleRoot, "scaffold"), plan);
    maybeRunPostUpgradeSteps(projectRoot, [
      ...plan.additions,
      ...plan.updates,
      ...plan.deletions,
    ]);

    const toolchainInfo = syncToolchain(targetBundleRoot, resolvedTargetVersion);
    writeUpdatedProjectState(
      projectRoot,
      projectMetadata,
      resolvedTargetVersion,
      scaffoldManifest,
      toolchainInfo.toolchainVersion
    );

    green(`Project upgraded to showpane@${resolvedTargetVersion}`);
  } finally {
    bundleSource.cleanup();
  }
}

async function openClaude(args: string[]) {
  let options: ClaudeCommandOptions;
  try {
    options = parseClaudeArgs(args);
  } catch (errorLike) {
    printBanner();
    console.log();
    error(errorLike instanceof Error ? errorLike.message : String(errorLike));
    printClaudeUsage();
    process.exit(1);
  }

  ensureShowpaneShim();
  const config = readShowpaneConfig();
  const workspaces = getWorkspaceEntries(config);

  if (workspaces.length === 0 && !options.project) {
    blue("No Showpane workspace found. Let's create one first.");
    console.log();
    await createProject(args);
    return;
  }

  if (workspaces.length > 0 && (options.companyName || options.yes)) {
    error("`--yes` and `--name` only apply when creating the first workspace.");
    printClaudeUsage();
    process.exit(1);
  }

  let workspace: WorkspaceEntry | undefined;
  if (options.project) {
    const matches = resolveWorkspaceSelection(config, options.project);
    if (matches.length === 0) {
      error(`Could not find a Showpane workspace matching: ${options.project}`);
      process.exit(1);
    }
    if (matches.length > 1) {
      error(`Multiple workspaces matched: ${options.project}`);
      for (const match of matches) {
        console.error(`    ${match.name} — ${match.path}`);
      }
      process.exit(1);
    }
    workspace = matches[0];
  } else if (workspaces.length === 1) {
    workspace = workspaces[0];
  } else if (!process.stdout.isTTY) {
    error("Multiple Showpane workspaces found. Use `showpane claude --project <name-or-path>`.");
    process.exit(1);
  } else {
    workspace = await promptWorkspaceSelection(workspaces);
  }

  const workspaceRoot = findWorkspaceRoot(workspace.path) ?? resolve(workspace.path);
  const selectedWorkspace = defaultWorkspaceEntry(workspaceRoot, {
    name: workspace.name || basename(workspaceRoot),
    deployMode: workspace.deployMode || "local",
    orgSlug: workspace.orgSlug || "",
  });
  upsertWorkspace(config, selectedWorkspace, true);
  writeShowpaneConfig(config);

  try {
    await openClaudeInWorkspace(selectedWorkspace);
  } catch (errorLike) {
    error(errorLike instanceof Error ? errorLike.message : String(errorLike));
    console.error(`Hint: Install Claude Code first, or use ${getResumeCommand()} later.`);
    process.exit(1);
  }
}

async function login() {
  printBanner();
  ensureShowpaneShim();

  blue("Authenticating with Showpane...");
  console.log();

  const initRes = await fetch(`${API_BASE}/api/cli/init`, { method: "POST" });
  if (!initRes.ok) {
    throw new Error(`Failed to start auth flow (${initRes.status})`);
  }

  const { code, userCode, verificationUrl } = await initRes.json();

  console.log(`  ${BOLD}Enter this code in your browser:${RESET}  ${BOLD}${GREEN}${userCode}${RESET}`);
  console.log();

  openBrowser(verificationUrl);
  blue(`Opened ${verificationUrl}`);
  console.log();
  blue("Waiting for authorization...");

  const pollInterval = 2000;
  const timeoutMs = 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((resolveLater) => setTimeout(resolveLater, pollInterval));

    const pollRes = await fetch(`${API_BASE}/api/cli/poll?code=${code}`);
    if (pollRes.status === 410) {
      error("Code expired. Please try again.");
      process.exit(1);
    }

    if (!pollRes.ok && pollRes.status !== 202) {
      throw new Error(`Poll failed (${pollRes.status})`);
    }

    const data = await pollRes.json();
    if (data.status !== "approved") continue;

    const config = readShowpaneConfig();
    config.accessToken = data.accessToken;
    config.accessTokenExpiresAt = data.tokenExpiresAt;
    config.orgSlug = data.orgSlug;
    config.portalUrl = data.portalUrl;
    config.vercelProjectId = data.vercelProjectId;

    const currentWorkspace = findWorkspaceRoot(process.cwd())
      ?? (config.app_path ? findWorkspaceRoot(config.app_path) ?? resolve(config.app_path) : null);

    if (currentWorkspace) {
      updateWorkspaceFromConfig(config, currentWorkspace, {
        name: basename(currentWorkspace),
        deployMode: "cloud",
        orgSlug: data.orgSlug,
      });
    } else {
      config.deploy_mode = "cloud";
    }

    writeShowpaneConfig(config);

    console.log();
    green(`Authenticated! Connected to ${BOLD}${data.orgSlug}${RESET}`);
    console.log();
    return;
  }

  error("Authentication timed out. Please try again.");
  process.exit(1);
}

const command = process.argv[2];
const packageRoot = getPackageRoot();

if (process.argv.includes("--version")) {
  console.log(getPackageVersion(packageRoot));
  process.exit(0);
}

if (command === "login") {
  login().catch((err) => {
    error(String(err));
    process.exit(1);
  });
} else if (command === "claude") {
  openClaude(process.argv.slice(3)).catch((err) => {
    error(String(err));
    process.exit(1);
  });
} else if (command === "projects") {
  try {
    printWorkspaceList(readShowpaneConfig());
  } catch (err) {
    error(String(err));
    process.exit(1);
  }
} else if (command === "sync") {
  syncCurrentToolchain().catch((err) => {
    error(String(err));
    process.exit(1);
  });
} else if (command === "upgrade") {
  upgradeProject(process.argv.slice(3)).catch((err) => {
    error(String(err));
    process.exit(1);
  });
} else {
  createProject(process.argv.slice(2)).catch((err) => {
    error(String(err));
    process.exit(1);
  });
}
