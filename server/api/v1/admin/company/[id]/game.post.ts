import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const GamePost = type({
  published: "boolean",
  developed: "boolean",
  id: "string",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const companyId = getRouterParam(h3, "id")!;

  const body = await readDropValidatedBody(h3, GamePost);

  if (!body.published && !body.developed)
    throw createError({
      statusCode: 400,
      statusMessage: "Must be related (either developed or published).",
    });

  const publisherConnect = body.published
    ? {
        publishers: {
          connect: {
            id: companyId,
          },
        },
      }
    : undefined;

  const developerConnect = body.developed
    ? {
        developers: {
          connect: {
            id: companyId,
          },
        },
      }
    : undefined;

  const gameId = await prisma.game.findUnique({
    where: { id: body.id },
    select: { id: true },
  });
  if (!gameId)
    throw createError({ statusCode: 404, message: "Game not found" });

  // SAFETY: Above check makes this update okay
  // eslint-disable-next-line drop/no-prisma-delete
  const game = await prisma.game.update({
    where: {
      id: body.id,
    },
    data: {
      ...publisherConnect,
      ...developerConnect,
    },
    include: {
      publishers: {
        select: {
          id: true,
        },
      },
      developers: {
        select: {
          id: true,
        },
      },
    },
  });

  return game;
});
