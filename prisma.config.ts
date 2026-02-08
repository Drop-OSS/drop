import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import path from "node:path";

// load .env variables
config();

// need to use built in env access as prisma's env function throws when DATABASE_URL is undefined
// this is acceptable as prisma throws already it actually needs the URL
const databaseURL = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma"),
  datasource: {
    url: databaseURL,
  },
});
