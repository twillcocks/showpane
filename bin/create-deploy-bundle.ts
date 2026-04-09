import AdmZip from "adm-zip";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

function walkFiles(dir: string, root: string, out: Set<string>) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, root, out);
      continue;
    }
    out.add(path.relative(root, fullPath));
  }
}

function collectTracedFiles(appPath: string): Set<string> {
  const files = new Set<string>();
  const outputRoot = path.join(appPath, ".vercel", "output");
  const functionsRoot = path.join(outputRoot, "functions");

  walkFiles(outputRoot, appPath, files);

  const queue = [functionsRoot];
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (entry.name !== ".vc-config.json") continue;

      const config = JSON.parse(readFileSync(fullPath, "utf8")) as {
        filePathMap?: Record<string, string>;
      };
      for (const relativePath of Object.values(config.filePathMap ?? {})) {
        files.add(relativePath);
      }
    }
  }

  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  if (!outputPath) {
    fail("Missing --output");
  }

  const appPath = process.cwd();
  const outputRoot = path.join(appPath, ".vercel", "output");
  if (!statSync(outputRoot, { throwIfNoEntry: false })?.isDirectory()) {
    fail("Missing .vercel/output. Run a prebuilt Vercel build first.");
  }

  const zip = new AdmZip();
  const tracedFiles = collectTracedFiles(appPath);

  for (const relativePath of tracedFiles) {
    const normalized = relativePath.replace(/\\/g, "/");

    if (normalized === ".env" || normalized.startsWith(".env.")) {
      zip.addFile(normalized, Buffer.from("NODE_ENV=production\n"));
      continue;
    }

    const fullPath = path.join(appPath, relativePath);
    const stat = statSync(fullPath, { throwIfNoEntry: false });
    if (!stat?.isFile()) {
      continue;
    }

    zip.addLocalFile(fullPath, path.dirname(normalized), path.basename(normalized));
  }

  zip.writeZip(outputPath);
  console.log(JSON.stringify({ ok: true, outputPath, fileCount: tracedFiles.size }));
}

main().catch((error) => {
  fail(String(error));
});
