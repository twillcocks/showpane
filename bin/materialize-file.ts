import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFile_ } from "../app/src/lib/storage";

function fail(message: string): never {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (flag: string) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
  };

  const storagePath = getArg("--storage-path");
  const output = getArg("--output");

  if (!storagePath || !output) {
    fail("Missing --storage-path or --output");
  }

  const data = await readFile_(storagePath);
  if (!data) {
    fail(`File not found in storage: ${storagePath}`);
  }

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, data);
}

main().catch((error) => {
  fail(String(error));
});
