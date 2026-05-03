import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = path.resolve("src/index.ts");

test("command lookup uses the platform default shell on Unix", () => {
  const source = fs.readFileSync(CLI_ENTRY, "utf8");

  assert.doesNotMatch(source, /shell:\s*["']\/bin\/zsh["']/);
  assert.match(source, /command -v \$\{command\}/);
});

test("first-run project creation writes env before dependency install", () => {
  const source = fs.readFileSync(CLI_ENTRY, "utf8");
  const createProjectBody = source.slice(
    source.indexOf("async function createProject"),
    source.indexOf("async function openClaude(args")
  );

  assert.ok(createProjectBody.indexOf('join(projectRoot, ".env")') > -1);
  assert.ok(createProjectBody.indexOf("await installDependencies(projectRoot, options.verbose)") > -1);
  assert.ok(
    createProjectBody.indexOf('join(projectRoot, ".env")') <
      createProjectBody.indexOf("await installDependencies(projectRoot, options.verbose)")
  );
});

test("showpane claude accepts first-run create flags before workspace handoff", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-claude-home-"));

  const result = spawnSync(
    "node",
    [
      "--import",
      "tsx",
      CLI_ENTRY,
      "claude",
      "--project",
      "missing-workspace",
      "--full-name",
      "Toby Willcocks",
      "--work-email",
      "toby@example.com",
      "--website",
      "example.com",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Unknown argument: --full-name/);
  assert.match(result.stderr, /Could not find a Showpane workspace matching: missing-workspace/);
});
