import { ensureAppEnvLoaded } from "@/lib/load-app-env";

ensureAppEnvLoaded();

export { PrismaClient } from "@/generated/prisma/client";
