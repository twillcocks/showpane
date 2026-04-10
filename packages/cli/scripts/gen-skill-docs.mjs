#!/usr/bin/env node

import fs from "node:fs";
import {
  discoverSkillTemplates,
  generateSkillDoc,
  getOutputPath,
  validateTemplateSource,
} from "./lib/skill-docs.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

let hadChanges = false;
let hadErrors = false;

for (const skillDir of discoverSkillTemplates()) {
  const templateSource = fs.readFileSync(`${skillDir}/SKILL.md.tmpl`, "utf8");
  const templateErrors = validateTemplateSource(templateSource, skillDir);
  if (templateErrors.length > 0) {
    hadErrors = true;
    for (const error of templateErrors) {
      console.error(error);
    }
    continue;
  }

  const { output } = generateSkillDoc(skillDir);
  const outputPath = getOutputPath(skillDir);
  const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";

  if (existing !== output) {
    hadChanges = true;
    if (DRY_RUN) {
      console.error(`Generated skill docs out of date: ${outputPath}`);
    } else {
      fs.writeFileSync(outputPath, output);
    }
  }
}

if (hadErrors) {
  process.exit(1);
}

if (DRY_RUN && hadChanges) {
  process.exit(1);
}
