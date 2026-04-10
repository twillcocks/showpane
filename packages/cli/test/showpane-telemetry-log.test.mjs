import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../bin/showpane-telemetry-log");

function run(homeDir, args, env = {}) {
  execFileSync(SCRIPT, args, {
    env: {
      ...process.env,
      HOME: homeDir,
      ...env,
    },
  });
}

test("showpane-telemetry-log always appends a local event", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-tel-log-"));
  fs.mkdirSync(path.join(homeDir, ".showpane"), { recursive: true });
  fs.writeFileSync(
    path.join(homeDir, ".showpane", "config.json"),
    `${JSON.stringify({ telemetry: "off" }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(homeDir, ".showpane", "current"), { recursive: true });
  fs.writeFileSync(path.join(homeDir, ".showpane", "current", "CLI_VERSION"), "0.4.13\n");

  run(homeDir, [
    "--skill", "portal-create",
    "--duration", "15",
    "--outcome", "success",
    "--session-id", "sess_1",
  ]);

  const analyticsPath = path.join(homeDir, ".showpane", "analytics", "skill-usage.jsonl");
  const lines = fs.readFileSync(analyticsPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.equal(payload.skill, "portal-create");
  assert.equal(payload.durationSeconds, 15);
  assert.equal(payload.outcome, "success");
  assert.equal(payload.sessionId, "sess_1");
  assert.equal(payload.toolchainVersion, "0.4.13");
});
