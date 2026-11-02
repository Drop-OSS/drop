import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import { existsSync, readdirSync, realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

type IngestBody = {
  /** Directory name inside the Filesystem library's baseDir holding the game. */
  dirName?: string;
  /** Title to show in the library; defaults to the directory name. */
  gameTitle?: string;
  /** Game executable relative to the directory, e.g. "nfsc.exe". */
  executable?: string;
  /** Optional launcher arguments appended after the executable. */
  arguments?: string[];
  /** Launch platform; defaults to Windows (disc ISOs are Windows-era). */
  os?: string;
  /** Version label recorded with the release; defaults to "disc". */
  versionName?: string;
};

const DIR_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$/;

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<IngestBody>(event);
  if (
    !body ||
    typeof body.dirName !== "string" ||
    !DIR_NAME_RE.test(body.dirName)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "dirName is required: a single directory name (no path separators) already present in the library folder",
    });
  }
  if (
    body.gameTitle !== undefined &&
    (typeof body.gameTitle !== "string" || body.gameTitle.length > 200)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "gameTitle must be a string of at most 200 characters",
    });
  }
  if (
    typeof body.executable !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._\-\\]{0,127}$/.test(body.executable) ||
    body.executable.includes("..")
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "executable is required: a relative path like nfsc.exe",
    });
  }
  // Captured for the task closure below: TS cannot carry the narrowing in.
  const executable = body.executable;
  if (
    body.arguments !== undefined &&
    (!Array.isArray(body.arguments) ||
      body.arguments.length > 32 ||
      body.arguments.some(
        (a) => typeof a !== "string" || a.length > 256 || a.includes("\0"),
      ))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "arguments must be an array of at most 32 plain strings",
    });
  }
  const versionName =
    typeof body.versionName === "string" && body.versionName.trim()
      ? body.versionName.trim().slice(0, 64)
      : "disc";

  const { prisma, library, baseDir } = await loadLocalTargets();
  const gameDir = join(baseDir, body.dirName);

  // The directory must exist inside the library and stay inside it: resolve
  // symlinks before accepting it, so a link out of the library never lands.
  if (!existsSync(gameDir)) {
    throw createError({
      statusCode: 404,
      statusMessage: `No directory '${body.dirName}' in the library folder yet - copy the game files first`,
    });
  }
  const realDir = realpathSync(gameDir);
  const realBase = realpathSync(baseDir);
  if (!realDir.startsWith(realBase + "/") || !statSync(realDir).isDirectory()) {
    throw createError({
      statusCode: 400,
      statusMessage: "dirName must resolve to a directory inside the library",
    });
  }
  const entryCount = readdirSync(realDir).length;
  if (entryCount === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "The directory is empty - nothing to ingest",
    });
  }
  if (!existsSync(join(realDir, body.executable.replace(/\\/g, "/")))) {
    throw createError({
      statusCode: 400,
      statusMessage: `Executable '${body.executable}' not found in '${body.dirName}'`,
    });
  }

  const libraryPath = body.dirName;
  const title = body.gameTitle ?? body.dirName;
  const { taskHandler, wrapTaskContext } =
    await import("~/server/internal/tasks");

  let taskId: string;
  try {
    taskId = await taskHandler.create({
      key: `depot:local:${libraryPath}`,
      taskGroup: "depot:ingest",
      acls: ["system:import:game:read"],
      name: `Ingesting local game ${title}`,
      async run(context) {
        const { progress, logger } = context;
        progress(20);
        logger.info(
          `Adopting library folder '${libraryPath}' (${entryCount} top-level entries) as game '${title}'`,
        );

        const game = await prisma.game.upsert({
          where: {
            metadataKey: {
              metadataSource: "Manual",
              metadataId: `local-${libraryPath}`,
            },
          },
          update: { libraryId: library.id, libraryPath, mName: title },
          create: {
            metadataSource: "Manual",
            metadataId: `local-${libraryPath}`,
            libraryId: library.id,
            libraryPath,
            mName: title,
            mShortDescription: `Local import from '${libraryPath}'.`,
            mDescription:
              "Adopted from a directory in the library folder by the depot pipeline (no store connection involved).",
            mReleased: new Date(0),
            mIconObjectId: "",
            mBannerObjectId: "",
            mCoverObjectId: "",
            mImageLibraryObjectIds: [],
          },
        });

        // Idempotent re-runs: an already-imported version stays as it is.
        const existing = await prisma.gameVersion.findFirst({
          where: { gameId: game.id, versionPath: versionName },
          select: { versionId: true },
        });
        if (existing) {
          logger.info(
            `Version ${versionName} is already imported (${existing.versionId}) - skipping the droplet import`,
          );
        } else {
          const { libraryManager } = await import("~/server/internal/library");
          const { Platform } = await import("~/prisma/client/enums");
          const os = (body.os ?? "windows").toLowerCase();
          const platform =
            os === "linux"
              ? Platform.Linux
              : os === "macos" || os === "osx"
                ? Platform.macOS
                : Platform.Windows;
          const launch = [
            executable.replace(/\//g, "\\"),
            ...(body.arguments ?? []),
          ].join(" ");
          await libraryManager.importVersion(
            game.id,
            {
              type: "local",
              identifier: versionName,
              name: versionName,
            },
            {
              id: game.id,
              version: {
                type: "local",
                identifier: versionName,
                name: versionName,
              },
              launches: [
                {
                  platform,
                  name: title,
                  launch,
                },
              ],
              setups: [],
              onlySetup: false,
              delta: false,
              requiredContent: [],
            },
            wrapTaskContext(context, {
              min: 30,
              max: 99,
              prefix: "[import] ",
            }),
          );
        }

        progress(99);
        logger.info(`${title} is now in the game library.`);
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|concurrent/i.test(message)) {
      throw createError({
        statusCode: 409,
        statusMessage:
          "A depot import is already running for this directory. Wait for it to finish (task panel).",
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: `Unable to queue the import: ${message}`,
    });
  }

  return { accepted: true, jobId: taskId, taskId, queued: "local-task" };
});

/** Resolve the Filesystem library and its base directory, mirroring the
 * store ingest routes (importVersion needs the per-game version dirs a
 * FlatFilesystem base provides). */
async function loadLocalTargets() {
  const { default: prisma } = await import("~/server/internal/db/database");
  const library = await prisma.library.findFirst({
    where: { backend: "Filesystem" },
    orderBy: { id: "asc" },
  });
  const baseDir = (library?.options as { baseDir?: string } | null)?.baseDir;
  if (!library || !baseDir) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Local ingest needs a Filesystem library with a baseDir - add one in the admin panel first.",
    });
  }
  // The route runs inside the server container: baseDir is the container path.
  return { prisma, library, baseDir: resolve(baseDir) };
}
