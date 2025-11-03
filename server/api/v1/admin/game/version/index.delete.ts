import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

const DeleteVersion = type({
  id: "string",
  versionName: "string",
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof DeleteVersion }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, [
      "game:version:delete",
    ]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, DeleteVersion);

    const gameId = body.id.toString();
    const version = body.versionName.toString();

    await libraryManager.deleteGameVersion(gameId, version);
    return {};
  },
);
