import aclManager from "~/server/internal/acls";
import { getRpId } from "~/server/internal/auth/webauthn";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.allowUserSuperlevel(h3); // No ACLs only allows session authentication
  if (!userId)
    throw createError({
      statusCode: 403,
      message: "Not signed in or superlevelled.",
    });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true },
  });
  if (!user)
    throw createError({
      statusCode: 500,
      message: "Session refers to non-existed user.",
    });

  const challenge = crypto.randomUUID().replaceAll("-", "");

  await sessionHandler.setSessionDataKey(h3, "webauthn/challenge", challenge);

  const rpId = await getRpId();

  return {
    challenge,
    rp: { name: "Drop", id: rpId },
    user: { userId, ...user },
  };
});
