import { type } from "arktype";
import type { AgeRatingOrganization } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import {
  getAvailableRatings,
  RATINGS_FOR_ORGANIZATION,
} from "~/utils/ageRatings";

const PatchRatings = type({
  bannedRatings: type({
    organization: "string",
    rating: "string",
  }).array(),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["user:delete"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const id = getRouterParam(h3, "id")!;
  const body = await readDropValidatedBody(h3, PatchRatings);

  const group = await prisma.userGroup.findUnique({ where: { id } });
  if (!group)
    throw createError({ statusCode: 404, message: "Group not found" });

  for (const br of body.bannedRatings) {
    if (!(br.organization in RATINGS_FOR_ORGANIZATION)) {
      throw createError({
        statusCode: 400,
        message: `Invalid organization: ${br.organization}`,
      });
    }
    const validRatings = getAvailableRatings(
      br.organization as AgeRatingOrganization,
    );
    if (!validRatings.includes(br.rating)) {
      throw createError({
        statusCode: 400,
        message: `Invalid rating "${br.rating}" for ${br.organization}`,
      });
    }
  }

  await prisma.$transaction([
    prisma.bannedAgeRating.deleteMany({
      where: { userGroupId: id },
    }),
    prisma.bannedAgeRating.createMany({
      data: body.bannedRatings.map((br) => ({
        userGroupId: id,
        organization: br.organization as AgeRatingOrganization,
        rating: br.rating,
      })),
    }),
  ]);

  const ratings = await prisma.bannedAgeRating.findMany({
    where: { userGroupId: id },
  });

  return ratings;
});
