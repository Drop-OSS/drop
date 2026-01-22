import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";

const UploadManifest = type({
  gameId: "string",
  versionName: "string",

  manifest: type({
    version: "'2'",
    size: "number",
    key: "16 <= number[] <= 16",
    chunks: type({
      ["string"]: {
        checksum: "string",
        iv: "16 <= number[] <= 16",
        files: type({
          filename: "string",
          start: "number",
          length: "number",
          permissions: "number",
        }).array(),
      },
    }),
  }),
  fileList: "string[]",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["depot:upload:new"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const { gameId, versionName, manifest, fileList } =
    await readDropValidatedBody(h3, UploadManifest);

  const version = await prisma.unimportedGameVersion.create({
    data: {
      game: {
        connect: {
          id: gameId,
        },
      },
      versionName,
      manifest,
      fileList,
    },
  });

  return { id: version.id };
});
