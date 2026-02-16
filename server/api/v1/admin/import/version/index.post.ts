import { type } from "arktype";
import { Platform } from "~/prisma/client/enums";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export const ImportVersion = type({
  id: "string",
  version: type({
    type: "'depot' | 'local'",
    identifier: "string",
    name: "string",
  }),
  displayName: "string?",

  launches: type({
    platform: type.valueOf(Platform),
    name: "string",
    launch: "string",
    umuId: "string?",
    emulatorId: "string?",
    suggestions: "string[]?",
  }).array(),

  setups: type({
    platform: type.valueOf(Platform),
    launch: "string",
  }).array(),

  onlySetup: "boolean = false",
  delta: "boolean = false",

  requiredContent: type("string")
    .array()
    .default(() => []),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, ImportVersion);

  const taskId = await libraryManager.importVersion(
    body.id,
    body.version,
    body,
  );
  if (!taskId)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid options for import",
    });

  return { taskId: taskId };
});
