import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import { MFAMec } from "~/prisma/client/enums";
import type { WebAuthNv1Credentials } from "~/server/internal/auth/webauthn";

export default defineEventHandler(async (h3) => {
  const userId = await aclManager.getUserIdACL(h3, []); // No ACLs only allows session authentication
  if (!userId) throw createError({ statusCode: 403 });

  const mfaMecs = await prisma.linkedMFAMec.findMany({
    where: {
      userId,
    },
  });
  // Sanitise and convert to map
  const mfaMecMap = Object.fromEntries(
    mfaMecs.map((v) => {
      switch (v.mec) {
        case MFAMec.TOTP:
          v.credentials = {};
          break;
        case MFAMec.WebAuthn: {
          const newCredentials = (
            v.credentials as unknown as WebAuthNv1Credentials
          ).passkeys.map((v) => ({
            name: v.name,
            id: v.id,
            created: v.created,
          }));
          v.credentials = newCredentials;
          break;
        }
      }
      return [v.mec, v];
    }),
  );
  return { mecs: mfaMecMap, available: Object.keys(MFAMec) };
});
