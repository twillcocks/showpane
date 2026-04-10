import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../bin/showpane-config");

function run(args, homeDir) {
  return execFileSync(SCRIPT, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: homeDir,
    },
  }).trim();
}

test("showpane-config supports nested get/set/unset", () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-config-"));

  run(["set", "telemetry", "anonymous"], homeDir);
  run(["set", "cloud.portalUrl", "https://acme.showpane.com"], homeDir);

  assert.equal(run(["get", "telemetry"], homeDir), "anonymous");
  assert.equal(run(["get", "cloud.portalUrl"], homeDir), "https://acme.showpane.com");

  execFileSync(SCRIPT, ["has", "cloud.portalUrl"], {
    env: { ...process.env, HOME: homeDir },
  });

  run(["unset", "cloud.portalUrl"], homeDir);

  assert.throws(() => run(["get", "cloud.portalUrl"], homeDir));
});
