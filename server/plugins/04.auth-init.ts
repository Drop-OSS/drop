import authManager from "~/server/internal/auth";
import prisma from "../internal/db/database";
import { APITokenMode } from "~/prisma/client/enums";
import type { UserACL } from "../internal/acls";

export const CLIENT_WEBTOKEN_ACLS: UserACL = [
  "read",
  "store:read",
  "object:read",
  "settings:read",

  "collections:read",
  "collections:new",
  "collections:add",
  "collections:remove",
  "collections:delete",

  "library:add",
  "library:remove",
];

export default defineNitroPlugin(async () => {
  await authManager.init();

  await prisma.aPIToken.updateMany({
    where: {
      mode: APITokenMode.Client,
    },
    data: {
      acls: CLIENT_WEBTOKEN_ACLS,
    },
  });

  await prisma.aPIToken.deleteMany({
    where: {
      id: "torrential",
    },
  });
});
