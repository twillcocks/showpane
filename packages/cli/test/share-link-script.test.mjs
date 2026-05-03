import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SCRIPT_ENTRY = path.resolve("../../bin/generate-share-link.ts");

test("share-link generator does not silently fall back to localhost", () => {
  const source = fs.readFileSync(SCRIPT_ENTRY, "utf8");

  assert.match(source, /if \(!baseUrl\) fail\("no_app_url"\)/);
  assert.doesNotMatch(source, /\?\? "http:\/\/localhost:3000"/);
});
