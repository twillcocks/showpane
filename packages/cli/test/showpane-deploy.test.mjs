import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const CLI_ENTRY = path.resolve("src/index.ts");

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents);
  fs.chmodSync(filePath, 0o755);
}

test("showpane deploy --json preserves structured failure output", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-deploy-home-"));
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-deploy-bin-"));
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-deploy-workspace-"));
  const currentBinDir = path.join(homeDir, ".showpane", "current", "bin");
  fs.mkdirSync(currentBinDir, { recursive: true });
  fs.writeFileSync(path.join(currentBinDir, "tsconfig.json"), "{}\n");
  fs.writeFileSync(path.join(currentBinDir, "deploy-to-cloud.ts"), "console.log('unused')\n");
  fs.writeFileSync(
    path.join(homeDir, ".showpane", "config.json"),
    JSON.stringify({ app_path: workspaceDir }, null, 2),
  );

  writeExecutable(
    path.join(binDir, "npx"),
    `#!/bin/sh
if [ "$1" = "tsx" ]; then
  printf '%s\\n' '{"ok":false,"step":"deployment-init","error":"Billing needs attention","detail":{"reason":"billing_inactive","nextAction":"open_checkout"}}'
  exit 1
fi
exit 1
`,
  );

  const result = spawnSync(
    "node",
    ["--import", "tsx", CLI_ENTRY, "deploy", "--json"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: homeDir,
        PATH: `${binDir}:${process.env.PATH}`,
      },
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), "");
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    ok: false,
    step: "deployment-init",
    error: "Billing needs attention",
    detail: {
      reason: "billing_inactive",
      nextAction: "open_checkout",
    },
  });
});
