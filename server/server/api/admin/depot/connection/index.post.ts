import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import {
  DEPOT_PROVIDERS,
  isUbisoftTwoFactorChallenge,
  maskConnection,
  saveConnection,
  type SaveConnectionInput,
} from "../../../../utils/depot/connections";
import { prismaConnectionStore } from "../../../../utils/depot/connection-store";

/**
 * Stores credentials for one store account so discovery endpoints can use
 * them without every caller pasting tokens. Credentials are never echoed
 * back; the response is the masked connection.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, [])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<SaveConnectionInput & { provider?: string }>(h3);
  if (!body || typeof body !== "object")
    throw createError({ statusCode: 400, statusMessage: "Body required" });
  if (
    !DEPOT_PROVIDERS.includes(body.provider as (typeof DEPOT_PROVIDERS)[number])
  )
    throw createError({
      statusCode: 400,
      statusMessage: `provider must be one of: ${DEPOT_PROVIDERS.join(", ")}`,
    });
  const saved = await saveConnection(prismaConnectionStore, body);
  if (isUbisoftTwoFactorChallenge(saved))
    // A 200 carrying the challenge: an error body's custom fields can be
    // stripped in production, and the code cannot be completed without it.
    return { connected: false, twoFactor: saved };
  return { connected: true, connection: maskConnection(saved) };
});
