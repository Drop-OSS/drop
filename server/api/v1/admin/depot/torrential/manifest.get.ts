import { ArkErrors, type } from "arktype";
import prisma from "~/server/internal/db/database";
import type { H3Event } from "h3";
import { castManifest } from "~/server/internal/library/manifest";

const AUTHORIZATION_HEADER_PREFIX = "Bearer ";

const Query = type({
  version: "string",
});

export async function depotAuthorization(h3: H3Event) {
  const authorization = getHeader(h3, "Authorization");
  if (!authorization) throw createError({ statusCode: 403 });

  if (!authorization.startsWith(AUTHORIZATION_HEADER_PREFIX))
    throw createError({ statusCode: 403 });
  const key = authorization.slice(AUTHORIZATION_HEADER_PREFIX.length);

  const depot = await prisma.depot.findFirst({ where: { key } });
  if (!depot) throw createError({ statusCode: 403 });
}

export default defineEventHandler(async (h3) => {
  await depotAuthorization(h3);

  const query = Query(getQuery(h3));
  if (query instanceof ArkErrors)
    throw createError({ statusCode: 400, message: query.summary });

  const version = await prisma.gameVersion.findUnique({
    where: {
      versionId: query.version,
    },
    select: {
      dropletManifest: true,
      versionPath: true,
      game: {
        select: {
          library: true,
          libraryPath: true,
        },
      },
    },
  });
  if (!version)
    throw createError({ statusCode: 404, message: "Game version not found" });

  return {
    manifest: castManifest(version.dropletManifest),
    library: version.game.library,
    libraryPath: version.game.libraryPath,
    versionPath: version.versionPath,
  };
});
