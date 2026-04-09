import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDeployBundle } from "@/lib/deploy-bundle";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createDeployBundle", () => {
  it("materializes symlinked function aliases into the artifact", () => {
    const appRoot = mkdtempSync(path.join(os.tmpdir(), "showpane-bundle-"));
    tempDirs.push(appRoot);

    const outputRoot = path.join(appRoot, ".vercel", "output");
    const realFuncDir = path.join(outputRoot, "functions", "real.func");
    mkdirSync(realFuncDir, { recursive: true });
    writeFileSync(path.join(outputRoot, "config.json"), JSON.stringify({ version: 3 }));
    writeFileSync(path.join(realFuncDir, ".vc-config.json"), JSON.stringify({ handler: "index.js" }));
    writeFileSync(path.join(realFuncDir, "index.js"), "module.exports = {};\n");

    const aliasDir = path.join(outputRoot, "functions", "alias.func");
    symlinkSync("real.func", aliasDir);

    const artifactPath = path.join(appRoot, "artifact.zip");
    const result = createDeployBundle(appRoot, artifactPath);
    expect(result.fileCount).toBe(5);

    const names = new Set(new AdmZip(artifactPath).getEntries().map((entry) => entry.entryName));
    expect(names.has(".vercel/output/config.json")).toBe(true);
    expect(names.has(".vercel/output/functions/real.func/.vc-config.json")).toBe(true);
    expect(names.has(".vercel/output/functions/real.func/index.js")).toBe(true);
    expect(names.has(".vercel/output/functions/alias.func/.vc-config.json")).toBe(true);
    expect(names.has(".vercel/output/functions/alias.func/index.js")).toBe(true);
  });
});
