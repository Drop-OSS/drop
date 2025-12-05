import { spawn } from "child_process";
import { Service } from "..";
import fs from "fs";
import prisma from "../../db/database";
import { APITokenMode } from "~/prisma/client/enums";
import { logger } from "../../logging";

const INTERNAL_DEPOT_URL = new URL(
  process.env.INTERNAL_DEPOT_URL ?? "http://localhost:5000",
);

export const TORRENTIAL_SERVICE = new Service(
  "torrential",
  () => {
    const localDir = fs.readdirSync(".");
    if ("torrential" in localDir) return spawn("./torrential", [], {});

    const envPath = process.env.TORRENTIAL_PATH;
    if (envPath) return spawn(envPath, [], {});

    return spawn("torrential", [], {});
  },
  async () => {
    const token = await prisma.aPIToken.upsert({
      where: {
        id: "torrential",
      },
      update: {
        name: "Torrential token",
        acls: ["depot"],
      },
      create: {
        id: "torrential",
        name: "Torrential token",
        acls: ["depot"],
        mode: APITokenMode.System,
      },
    });

    await $fetch(`${INTERNAL_DEPOT_URL.toString()}token`, {
      method: "POST",
      body: { token: token.token },
    });
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async () => await $fetch(`${INTERNAL_DEPOT_URL.toString()}healthcheck`),
  {
    async invalidate(gameId: string, versionName: string) {
      try {
        await $fetch(`${INTERNAL_DEPOT_URL.toString()}invalidate`, {
          method: "POST",
          body: {
            game_id: gameId,
            version_name: versionName,
          },
        });
      } catch (e) {
        logger.warn("invalidate torrential cache failed with error: " + e);
      }
    },
  },
);
