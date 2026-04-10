import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { discoverSkillTemplates, generateSkillDoc, REPO_ROOT } from "../scripts/lib/skill-docs.mjs";

test("discovers portal skill templates", () => {
  const templates = discoverSkillTemplates();
  assert.ok(templates.length >= 15);
  assert.ok(templates.every((entry) => entry.includes("skills/portal-")));
});

test("generated skill docs replace the shared placeholders", () => {
  const templates = discoverSkillTemplates();
  const portalShare = templates.find((entry) => entry.includes("portal-share"));
  assert.ok(portalShare);

  const { output } = generateSkillDoc(portalShare);
  assert.match(output, /showpane-update-check/);
  assert.match(output, /showpane-config/);
  assert.doesNotMatch(output, /\{\{PREAMBLE\}\}/);
  assert.doesNotMatch(output, /\{\{COMPLETION\}\}/);
});

test("shared runtime principles doc exists", () => {
  const runtimePrinciplesPath = path.join(REPO_ROOT, "skills", "shared", "runtime-principles.md");
  assert.equal(fs.existsSync(runtimePrinciplesPath), true);
});
