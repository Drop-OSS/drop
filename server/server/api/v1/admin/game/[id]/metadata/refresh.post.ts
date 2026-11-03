import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import metadataHandler from "~/server/internal/metadata";
import prisma from "~/server/internal/db/database";

type RefreshBody = {
  /** Overwrite fields that already hold a value (manual picks included). */
  replace?: boolean;
};

/**
 * Re-fetch a game's cached metadata from its source without deleting and
 * re-adding the game. Two source families are supported:
 *
 *  - Provider games (Steam, IGDB, ...): the provider's fetchGame is re-run
 *    as a task; see MetadataHandler.refreshGameTask for the field rules.
 *  - Store acquisitions (the Manual-source rows the depot pipeline creates,
 *    `gog-<id>`): the keyless GOG store page is re-parsed and attached.
 *
 * Default mode only fills empty fields, so manual admin edits always
 * survive; `{"replace": true}` opts into overwriting them. Either way the
 * work runs as a task and a failure leaves the row untouched.
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const gameId = getRouterParam(h3, "id")!;
  const body = await readBody<RefreshBody>(h3).catch(() => null);
  const replace = body?.replace === true;

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: {
      id: true,
      mName: true,
      metadataSource: true,
      metadataId: true,
    },
  });
  if (!game)
    throw createError({ statusCode: 404, statusMessage: "Game not found" });

  if (game.metadataSource === "Manual") {
    const gogId = /^gog-(\d+)$/.exec(game.metadataId)?.[1];
    if (!gogId)
      throw createError({
        statusCode: 400,
        statusMessage:
          "This game has no provider source to refresh from (manual entry, or a store without a keyless art source)",
      });

    const { taskHandler } = await import("~/server/internal/tasks");
    const taskId = await taskHandler.create({
      key: `depot:art:${gameId}`,
      taskGroup: "depot:ingest",
      acls: ["system:import:game:read"],
      name: `Refreshing store info for "${game.mName}"`,
      async run(context) {
        const { progress, logger } = context;
        const manifest = await prisma.storeManifest.findFirst({
          where: { externalGameId: gogId, connection: { provider: "GOG" } },
          orderBy: { updatedAt: "desc" },
        });
        const slug = (manifest?.payload as { slug?: unknown } | null)?.slug;

        // Product copy and release date from the keyless catalogue API. The
        // placeholder strings the ingest used to write count as empty, and so
        // does the epoch date it falls back to, so games imported before this
        // existed backfill with a plain refresh.
        let metadataFields = 0;
        try {
          const { fetchGogProductInfo, parseGogReleaseDate } =
            await import("~/server/utils/depot/provider-info");
          const info = await fetchGogProductInfo(gogId);
          if (info) {
            const current = await prisma.game.findUnique({
              where: { id: gameId },
              select: {
                mShortDescription: true,
                mDescription: true,
                mReleased: true,
              },
            });
            if (current) {
              const placeholderShort = `GOG product ${gogId}.`;
              const placeholderDescription = `Acquired from GOG (product ${gogId}) by the depot pipeline.`;
              const isEmpty = (value: string, placeholder: string) =>
                value.trim().length === 0 || value === placeholder;
              const released = parseGogReleaseDate(info.releaseDate);
              const data = {
                ...(info.shortDescription &&
                (replace ||
                  isEmpty(current.mShortDescription, placeholderShort))
                  ? { mShortDescription: info.shortDescription }
                  : {}),
                ...(info.description &&
                (replace ||
                  isEmpty(current.mDescription, placeholderDescription))
                  ? { mDescription: info.description }
                  : {}),
                ...(released && (replace || current.mReleased.getTime() <= 0)
                  ? { mReleased: released }
                  : {}),
              };
              if (Object.keys(data).length > 0) {
                await prisma.game.updateMany({
                  where: { id: gameId },
                  data,
                });
                metadataFields = Object.keys(data).length;
              }
            }
          }
        } catch (error) {
          logger.warn(
            `GOG product info refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        const { fetchGogStoreArt, cachedManifestArt, attachProviderArt } =
          await import("~/server/utils/depot/provider-art");
        let art =
          typeof slug === "string" && slug
            ? await fetchGogStoreArt(slug)
            : undefined;
        if (!art) {
          logger.info("Store page unavailable, falling back to cached tile");
          art = cachedManifestArt(manifest?.image);
        }
        const artFields = art
          ? await attachProviderArt(gameId, art, logger, { replace })
          : 0;
        const filled = metadataFields + artFields;
        if (filled === 0)
          throw new Error(
            replace
              ? "Store published no description or artwork to replace with"
              : "Nothing was empty to fill; use replace to overwrite",
          );
        logger.info(
          `Refreshed store info (${metadataFields} metadata, ${artFields} art fields).`,
        );
        progress(100);
        context.addAction(`View Game:/admin/library/${gameId}`);
      },
    });
    return { accepted: true, taskId, source: "store:gog" };
  }

  const taskId = await metadataHandler.refreshGameTask(
    {
      id: game.id,
      name: game.mName,
      metadataSource: game.metadataSource,
      metadataId: game.metadataId,
    },
    replace,
  );
  if (!taskId)
    throw createError({
      statusCode: 400,
      statusMessage: `No metadata provider registered for "${game.metadataSource}"`,
    });
  return { accepted: true, taskId, source: "provider" };
});
