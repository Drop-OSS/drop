import sessionHandler from "~/server/internal/session";
import { type } from "arktype";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/client";

export default defineEventHandler(async (h3) => {
  const session = await sessionHandler.getSession(h3);
  if (!session || session.level == 0)
    throw createError({
      statusCode: 403,
      message: "Sign in before completing MFA",
    });

  const linkedMFAMec = await prisma.linkedMFAMec.findMany({
    where: {
      userId: session.userId,
    },
    select: {
      mec: true,
    },
  });

  return linkedMFAMec.map((v) => v.mec);
});
