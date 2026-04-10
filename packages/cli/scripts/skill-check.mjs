#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  SKILLS_ROOT,
  discoverSkillTemplates,
  getOutputPath,
  getTemplatePath,
  validateTemplateSource,
} from "./lib/skill-docs.mjs";

const errors = [];
const templateDirs = new Set(discoverSkillTemplates());

for (const entry of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith("portal-")) continue;
  const skillDir = path.join(SKILLS_ROOT, entry.name);
  if (!templateDirs.has(skillDir)) {
    errors.push(`${skillDir}: missing SKILL.md.tmpl`);
    continue;
  }

  const templatePath = getTemplatePath(skillDir);
  const outputPath = getOutputPath(skillDir);
  const templateSource = fs.readFileSync(templatePath, "utf8");
  errors.push(...validateTemplateSource(templateSource, skillDir));
  if (!fs.existsSync(outputPath)) {
    errors.push(`${skillDir}: missing generated SKILL.md`);
  }
}

if (!fs.existsSync(path.join(REPO_ROOT, "skills", "SKILL.md.tmpl"))) {
  errors.push("skills/SKILL.md.tmpl: missing root skill template reference");
}

if (!fs.existsSync(path.join(REPO_ROOT, "skills", "shared", "runtime-principles.md"))) {
  errors.push("skills/shared/runtime-principles.md: missing shared runtime principles");
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}
