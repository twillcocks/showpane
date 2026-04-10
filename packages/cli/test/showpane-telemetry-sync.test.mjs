import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../bin/showpane-telemetry-sync");

function run(homeDir, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(SCRIPT, [], {
      env: {
        ...process.env,
        HOME: homeDir,
        ...env,
      },
      stdio: "ignore",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`telemetry sync exited with code ${code}`));
    });
  });
}

test("showpane-telemetry-sync posts anonymous telemetry and advances the cursor", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-tel-sync-"));
  const showpaneDir = path.join(homeDir, ".showpane");
  const analyticsDir = path.join(showpaneDir, "analytics");
  fs.mkdirSync(analyticsDir, { recursive: true });
  fs.writeFileSync(
    path.join(showpaneDir, "config.json"),
    `${JSON.stringify({ telemetry: "anonymous" }, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(analyticsDir, "skill-usage.jsonl"),
    `${JSON.stringify({
      v: 1,
      eventId: "evt_1",
      ts: "2026-04-10T12:00:00.000Z",
      eventType: "skill_run",
      skill: "portal-create",
      durationSeconds: 12,
      outcome: "success",
      sessionId: "sess_1",
      source: "live",
      toolchainVersion: "0.4.13",
      appVersion: "1.1.4",
      os: "darwin",
      arch: "arm64",
    })}\n`,
  );

  let receivedAuth = "";
  let receivedBody = "";
  const server = http.createServer((req, res) => {
    receivedAuth = req.headers.authorization || "";
    req.on("data", (chunk) => {
      receivedBody += chunk.toString();
    });
    req.on("end", () => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, received: 1, inserted: 1 }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine test server port");
  }

  try {
    await run(homeDir, {
      SHOWPANE_TELEMETRY_BASE_URL: `http://127.0.0.1:${address.port}`,
    });
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }

  assert.equal(receivedAuth, "");
  const parsed = JSON.parse(receivedBody);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].eventId, "evt_1");

  const cursor = fs.readFileSync(path.join(analyticsDir, ".last-sync-line"), "utf8").trim();
  assert.equal(cursor, "1");
});

test("showpane-telemetry-sync exits when telemetry is off", async () => {
  const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "showpane-tel-off-"));
  const showpaneDir = path.join(homeDir, ".showpane");
  const analyticsDir = path.join(showpaneDir, "analytics");
  fs.mkdirSync(analyticsDir, { recursive: true });
  fs.writeFileSync(
    path.join(showpaneDir, "config.json"),
    `${JSON.stringify({ telemetry: "off" }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(analyticsDir, "skill-usage.jsonl"), "{}\n");

  await run(homeDir, {
    SHOWPANE_TELEMETRY_BASE_URL: "http://127.0.0.1:1",
  });

  assert.equal(fs.existsSync(path.join(analyticsDir, ".last-sync-line")), false);
});
