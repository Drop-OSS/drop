import { type } from "arktype";
import { throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";
import metadataHandler from "~/server/internal/metadata";

const ImportGameBody = type({
  library: "string",
  path: "string",
  ["metadata?"]: {
    id: "string",
    sourceId: "string",
    name: "string",
  },
}).configure(throwingArktype);

export default defineEventHandler<{ body: typeof ImportGameBody.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["import:game:new"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const { library, path, metadata } = await readValidatedBody(
      h3,
      ImportGameBody,
    );

    if (!path)
      throw createError({
        statusCode: 400,
        statusMessage: "Path missing from body",
      });

    const valid = await libraryManager.checkUnimportedGamePath(library, path);
    if (!valid)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid library or game.",
      });

    if (!metadata) {
      return await metadataHandler.createGameWithoutMetadata(library, path);
    } else {
      return await metadataHandler.createGame(metadata, library, path);
    }
  },
);
