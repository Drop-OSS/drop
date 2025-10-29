import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~~/server/arktype";
import aclManager from "~~/server/internal/acls";
import libraryManager from "~~/server/internal/library";

export const LaunchCommands = type({
  name: "string > 0",
  description: "string = ''",
  launchCommand: "string > 0",
  launchArgs: "string = ''",
}).array();

const ImportVersionBase = type({
  id: "string",
  version: "string",
  name: "string?",

  platform: "string",
  delta: "boolean = false",
});

const ImportGameVersion = type({
  mode: "'game'",
  onlySetup: "boolean = false",
  umuId: "string = ''",

  install: "string?",
  installArgs: "string?",
  launches: LaunchCommands,
  uninstall: "string?",
  uninstallArgs: "string?",
});

const ImportRedistVersion = type({
  mode: "'redist'",
  install: "string?",
  installArgs: "string?",
  launches: LaunchCommands,
  uninstall: "string?",
  uninstallArgs: "string?",
});

export const ImportVersion = ImportVersionBase.and(
  ImportGameVersion.or(ImportRedistVersion),
).configure(throwingArktype);

export type ImportGameVersion = typeof ImportVersionBase.infer &
  typeof ImportGameVersion.infer;

export type ImportRedistVersion = typeof ImportVersionBase.infer &
  typeof ImportRedistVersion.infer;

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["import:version:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, ImportVersion);

  // startup & delta require more complex checking logic
  const taskId = await libraryManager.importVersion(
    body.id,
    body.version,
    body,
  );
  if (!taskId)
    throw createError({
      statusCode: 400,
      message: "Invalid options for import",
    });

  return { taskId: taskId };
});
