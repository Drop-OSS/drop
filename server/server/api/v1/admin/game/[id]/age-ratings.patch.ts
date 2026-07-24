import { type } from "arktype";
import { AgeRatingOrganization } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { getAvailableRatings, RATINGS_FOR_ORGANIZATION } from "~/utils/ageRatings";

const PatchAgeRatings = type({
  ageRatings: type({
    organization: "string",
    rating: "string",
  }).array(),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["game:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, PatchAgeRatings);
  const id = getRouterParam(h3, "id")!;

  for (const ar of body.ageRatings) {
    if (!(ar.organization in RATINGS_FOR_ORGANIZATION)) {
      throw createError({
        statusCode: 400,
        message: `Invalid organization: ${ar.organization}`,
      });
    }
    const validRatings = getAvailableRatings(
      ar.organization as AgeRatingOrganization,
    );
    if (!validRatings.includes(ar.rating)) {
      throw createError({
        statusCode: 400,
        message: `Invalid rating "${ar.rating}" for ${ar.organization}`,
      });
    }
  }

  const game = await prisma.game.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!game) throw createError({ statusCode: 404, message: "Game not found" });

  await prisma.$transaction([
    // SAFETY: Okay to disable due to check above
    // eslint-disable-next-line drop/no-prisma-delete
    prisma.gameAgeRating.deleteMany({
      where: { gameId: id },
    }),
    prisma.gameAgeRating.createMany({
      data: body.ageRatings.map((ar) => ({
        gameId: id,
        organization: ar.organization as AgeRatingOrganization,
        rating: ar.rating,
      })),
    }),
  ]);

  return await prisma.gameAgeRating.findMany({
    where: { gameId: id },
  });
});
