import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { MFAMec } from "~/prisma/client/enums";
import aclManager from "~/server/internal/acls";
import {
  getRpId,
  WebAuthNv1Credentials,
} from "~/server/internal/auth/webauthn";
import { systemConfig } from "~/server/internal/config/sys-conf";
import prisma from "~/server/internal/db/database";
import sessionHandler from "~/server/internal/session";

export default defineEventHandler(async (h3) => {
  const rpID = await getRpId();

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [],
  });

  if (
    !(await sessionHandler.setSessionDataKey(
      h3,
      "webauthn/options",
      JSON.stringify(options),
    ))
  )
    throw createError({
      statusCode: 500,
      message: "Failed to set session data key",
    });

  return options;
});
