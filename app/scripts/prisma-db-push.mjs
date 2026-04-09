import { getSchemaPath, runPrismaCommand } from "./prisma-schema.mjs";

const passthroughArgs = process.argv.slice(2);
const schemaPath = getSchemaPath();

runPrismaCommand(["db", "push", "--schema", schemaPath, "--skip-generate", ...passthroughArgs]);
runPrismaCommand(["generate", "--schema", schemaPath]);
