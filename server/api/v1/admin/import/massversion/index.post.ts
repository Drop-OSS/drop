import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import { aclManager } from "~/server/internal/acls";
import { libraryManager } from "~/server/internal/library";
import { taskHandler, wrapTaskContext } from "~/server/internal/tasks";
import type { Platform } from "~/prisma/client/client";

const MassImport = type({
  versions: type({
    id: "string",
    version: type({
      type: "'depot' | 'local'",
      identifier: "string",
      name: "string",
    }),
    displayName: "string?",
    setupMode: "boolean = false",
  }).array(),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, MassImport);

  const taskId = await taskHandler.create({
    key: "mass-import",
    taskGroup: "import:version",
    acls: ["system:import:version:read"],
    name: `Mass-importing for ${body.versions.length} versions`,
    async run({ progress, logger, addAction }) {
      for (
        let versionIndex = 0;
        versionIndex < body.versions.length;
        versionIndex++
      ) {
        const version = body.versions[versionIndex];
        const preload = await libraryManager.fetchUnimportedVersionInformation(
          version.id,
          version.version,
        );
        if (!preload) {
          logger.warn(
            `failed to fetch preload information for: ${version.version.name} (${version.version.type})`,
          );
          continue;
        }
        const chosenPreload = preload.at(0);
        if (!chosenPreload) {
          logger.warn(
            `failed to find preload information for: ${version.version.name} (${version.version.type}), there were no auto-discovered executables`,
          );
          continue;
        }

        const launches: Array<{
          platform: Platform;
          launch: string;
          name: string;
        }> = [];
        const setups: Array<{ platform: Platform; launch: string }> = [];

        if (version.setupMode) {
          setups.push({
            platform: chosenPreload.platform,
            launch: chosenPreload.filename,
          });
        } else {
          launches.push({
            platform: chosenPreload.platform,
            launch: chosenPreload.filename,
            name: "Play",
          });
        }

        logger.info(`importing ${version.version.name}`);
        const min = versionIndex / body.versions.length;
        const max = (versionIndex + 1) / body.versions.length;

        await libraryManager.importVersion(
          version.id,
          version.version,
          {
            id: version.id,
            version: version.version,
            launches,
            setups,
            onlySetup: version.setupMode,
            delta: false,
            requiredContent: [],
          },
          wrapTaskContext(
            {
              logger,
              progress,
              addAction,
            },
            {
              min: min * 100,
              max: max * 100,
              prefix: `${version.version.name}`,
            },
          ),
        );

        logger.info(`finished import for ${version.version.name}`);

        progress(max * 100);
      }
    },
  });

  return { taskId };
});
