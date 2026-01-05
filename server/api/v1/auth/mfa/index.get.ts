import sessionHandler from "~/server/internal/session";
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
  const session = await sessionHandler.getSession(h3);
  if (!session || !session.authenticated || session.authenticated.level == 0)
    throw createError({
      statusCode: 403,
      message: "Sign in before completing MFA",
    });

  const linkedMFAMec = await prisma.linkedMFAMec.findMany({
    where: {
      userId: session.authenticated.userId,
    },
    select: {
      mec: true,
    },
  });

  return linkedMFAMec.map((v) => v.mec);
});
