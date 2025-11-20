import { config } from "dotenv";
import type { PrismaConfig } from "prisma";
import path from "node:path";

config();

export default {
  schema: path.join("prisma"),
  earlyAccess: true,
} satisfies PrismaConfig;
