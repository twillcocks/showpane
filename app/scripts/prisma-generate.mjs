import { getSchemaPath, runPrismaCommand } from "./prisma-schema.mjs";

runPrismaCommand(["generate", "--schema", getSchemaPath()]);
