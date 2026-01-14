import { spawn } from "child_process";
import { Service } from "..";
import fs from "fs";
import prisma from "../../db/database";
import { logger } from "../../logging";
import { systemConfig } from "../../config/sys-conf";

const INTERNAL_DEPOT_URL = new URL(
  process.env.INTERNAL_DEPOT_URL ?? "http://localhost:5000",
);

export const TORRENTIAL_SERVICE = new Service(
  "torrential",
  () => {
    const localDir = fs.readdirSync(".");
    if ("torrential" in localDir) {
      const stat = fs.statSync("./torrential");
      if (stat.isDirectory()) {
        // in dev and we have the submodule
        logger.info(
          "torrential detected in development mode - building from source",
        );
        return spawn(
          "cargo run --manifest-path ./torrential/Cargo.toml",
          [],
          {},
        );
      } else {
        // binary
        return spawn("./torrential", [], {});
      }
    }

    const envPath = process.env.TORRENTIAL_PATH;
    if (envPath) return spawn(envPath, [], {});

    return spawn("torrential", [], {});
  },
  async () => {
    const externalUrl = systemConfig.getExternalUrl();
    const depot = await prisma.depot.upsert({
      where: {
        id: "torrential",
      },
      update: {
        endpoint: `${externalUrl}/api/v1/depot`,
      },
      create: {
        id: "torrential",
        endpoint: `${externalUrl}/api/v1/depot`,
      },
    });

    await $fetch(`${INTERNAL_DEPOT_URL.toString()}key`, {
      method: "POST",
      body: { key: depot.key },
    });
    return true;
  },
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  async () => await $fetch(`${INTERNAL_DEPOT_URL.toString()}healthcheck`),
  {
    async invalidate(gameId: string, versionId: string) {
      try {
        await $fetch(`${INTERNAL_DEPOT_URL.toString()}invalidate`, {
          method: "POST",
          body: {
            game: gameId,
            version: versionId,
          },
        });
      } catch (e) {
        logger.warn("invalidate torrential cache failed with error: " + e);
      }
    },
  },
);
