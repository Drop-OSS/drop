import { defineDropTask } from "..";
import yaml from "js-yaml";
import { Platform } from "~/prisma/client";
import type { LudusaviPlatformEntryCreateOrConnectWithoutLudusaviEntryInput } from "~/prisma/client/models";
import prisma from "../../db/database";

type ConnectOrCreateShorthand =
  LudusaviPlatformEntryCreateOrConnectWithoutLudusaviEntryInput;

type LudusaviModel = {
  [key: string]: {
    files?: {
      [key: string]: {
        tags?: Array<string>;
        when?: Array<{ os?: string }>;
      };
    };
    registry?: { [key: string]: { tags?: Array<string> } };
    steam?: { id: number };
  };
};

export default defineDropTask({
  buildId: () => `ludusavi:import:${new Date().toISOString()}`,
  name: "Import Ludusavi",
  acls: [],
  taskGroup: "ludusavi:import",
  async run({ log, progress }) {
    const manifest = yaml.load(
      await $fetch<string>(
        "https://raw.githubusercontent.com/mtkennerly/ludusavi-manifest/refs/heads/master/data/manifest.yaml",
      ),
    ) as LudusaviModel;
    let currentProgress = 10;

    progress(currentProgress);

    const entries = Object.entries(manifest).filter(
      ([, data]) => data.files || data.registry,
    );
    const increment = 90 / entries.length;
    for (const [name, data] of entries) {
      const iterableFiles = data.files ? Object.entries(data.files) : undefined;

      function findFilesForOperatingSystem(os: string) {
        return iterableFiles?.filter((e) =>
          e[1].when?.find((v) => v.os === os),
        );
      }

      const connectOrCreate: ConnectOrCreateShorthand[] = [];

      const windowsData = {
        registry: data.registry,
        files: findFilesForOperatingSystem("windows"),
      };

      if (windowsData.registry || windowsData.files) {
        const create: ConnectOrCreateShorthand = {
          where: {
            ludusaviEntryName_platform: {
              ludusaviEntryName: name,
              platform: Platform.Windows,
            },
          },
          create: {
            platform: Platform.Windows,
            files: windowsData.files?.map((e) => e[0]) ?? [],
            registry: Object.entries(windowsData.registry ?? {}).map(
              (e) => e[0],
            ),
          },
        };

        connectOrCreate.push(create);
      }

      const linuxData = {
        files: findFilesForOperatingSystem("linux"),
      };

      if (linuxData.files) {
        const create: ConnectOrCreateShorthand = {
          where: {
            ludusaviEntryName_platform: {
              ludusaviEntryName: name,
              platform: Platform.Linux,
            },
          },
          create: {
            platform: Platform.Linux,
            files: linuxData.files?.map((e) => e[0]) ?? [],
            registry: [],
          },
        };

        connectOrCreate.push(create);
      }

      const macData = {
        files: findFilesForOperatingSystem("mac"),
      };

      if (macData.files) {
        const create: ConnectOrCreateShorthand = {
          where: {
            ludusaviEntryName_platform: {
              ludusaviEntryName: name,
              platform: Platform.macOS,
            },
          },
          create: {
            platform: Platform.macOS,
            files: macData.files?.map((e) => e[0]) ?? [],
            registry: [],
          },
        };

        connectOrCreate.push(create);
      }

      const steamId = data.steam?.id.toString() ?? null;

      await prisma.ludusaviEntry.upsert({
        where: {
          name,
        },
        create: {
          name,
          steamId,
          entries: { connectOrCreate },
        },
        update: {
          steamId,
          entries: { connectOrCreate },
        },
      });

      currentProgress += increment;
      progress(currentProgress);
      log(`Imported game "${name}"`);
    }
  },
});
