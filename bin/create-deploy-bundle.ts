import AdmZip from "adm-zip";
import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
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

function addPathToZip(zip: AdmZip, sourcePath: string, zipPath: string): number {
  const zipPathPosix = zipPath.replace(/\\/g, "/");

  if (zipPathPosix === ".env" || zipPathPosix.startsWith(".env.")) {
    zip.addFile(zipPathPosix, Buffer.from("NODE_ENV=production\n"));
    return 1;
  }

  const entry = lstatSync(sourcePath, { throwIfNoEntry: false });
  if (!entry) {
    return 0;
  }

  if (entry.isSymbolicLink()) {
    return addPathToZip(zip, realpathSync(sourcePath), zipPathPosix);
  }

  if (entry.isDirectory()) {
    let count = 0;
    for (const child of readdirSync(sourcePath, { withFileTypes: true })) {
      count += addPathToZip(
        zip,
        path.join(sourcePath, child.name),
        path.posix.join(zipPathPosix, child.name),
      );
    }
    return count;
  }

  if (!entry.isFile() && !statSync(sourcePath, { throwIfNoEntry: false })?.isFile()) {
    return 0;
  }

  zip.addLocalFile(sourcePath, path.posix.dirname(zipPathPosix), path.posix.basename(zipPathPosix));
  return 1;
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
    fail("Missing .vercel/output. Run `npm run cloud:build` first.");
  }

  const zip = new AdmZip();
  const tracedFiles = collectTracedFiles(appPath);
  let fileCount = 0;

  for (const relativePath of tracedFiles) {
    fileCount += addPathToZip(zip, path.join(appPath, relativePath), relativePath);
  }

  zip.writeZip(outputPath);
  console.log(JSON.stringify({ ok: true, outputPath, fileCount }));
}

main().catch((error) => {
  fail(String(error));
});
