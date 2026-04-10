import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../bin/showpane-update-check");

function makeFakeNpm(binDir, version) {
  const npmPath = path.join(binDir, "npm");
  fs.writeFileSync(
    npmPath,
    `#!/bin/sh
if [ "$1" = "view" ] && [ "$2" = "showpane" ] && [ "$3" = "version" ]; then
  echo "${version}"
  exit 0
fi
exit 1
`,
  );
  fs.chmodSync(npmPath, 0o755);
}

function run(homeDir, pathPrefix) {
  return execFileSync(SCRIPT, [], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeDir,
      PATH: `${pathPrefix}:${process.env.PATH}`,
    },
  }).trim();
}

test("showpane-update-check reports newer published versions", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-update-"));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-npm-"));
  makeFakeNpm(binDir, "9.9.9");

  const toolchainDir = path.join(homeDir, ".showpane", "toolchains", "0.1.0");
  fs.mkdirSync(toolchainDir, { recursive: true });
  fs.writeFileSync(path.join(toolchainDir, "CLI_VERSION"), "0.1.0\n");
  fs.symlinkSync(toolchainDir, path.join(homeDir, ".showpane", "current"));

  const output = run(homeDir, binDir);
  assert.match(output, /^UPGRADE_AVAILABLE 0\.1\.0 9\.9\.9$/);
});

test("showpane-update-check respects update_check=false", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-update-off-"));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-npm-"));
  makeFakeNpm(binDir, "9.9.9");

  const toolchainDir = path.join(homeDir, ".showpane", "toolchains", "0.1.0");
  fs.mkdirSync(toolchainDir, { recursive: true });
  fs.writeFileSync(path.join(toolchainDir, "CLI_VERSION"), "0.1.0\n");
  fs.symlinkSync(toolchainDir, path.join(homeDir, ".showpane", "current"));
  fs.writeFileSync(
    path.join(homeDir, ".showpane", "config.json"),
    `${JSON.stringify({ update_check: false }, null, 2)}\n`,
  );

  const output = run(homeDir, binDir);
  assert.equal(output, "");
});
