import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import path from "node:path";

// load .env variables
config();

export default defineConfig({
  schema: path.join("prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
});
