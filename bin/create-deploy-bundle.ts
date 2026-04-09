import { createDeployBundle } from "../app/src/lib/deploy-bundle";

function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : undefined;

  if (!outputPath) {
    fail("Missing --output");
  }

  const appPath = process.cwd();
  const { fileCount } = createDeployBundle(appPath, outputPath);
  console.log(JSON.stringify({ ok: true, outputPath, fileCount }));
}

main().catch((error) => {
  fail(String(error));
});
