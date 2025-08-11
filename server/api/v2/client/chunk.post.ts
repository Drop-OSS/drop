import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import contextManager from "~/server/internal/downloads/coordinator";
import libraryManager from "~/server/internal/library";

const GetChunk = type({
  context: "string",
  files: type({
    filename: "string",
    chunkIndex: "number",
  }).array(),
}).configure(throwingArktype);

/**
 * Part of v2 download API. Intended to be client-only.
 *
 * Returns raw stream of all files requested, in order.
 * @response `application/octet-stream` stream of all files concatenated
 */
export default defineEventHandler<{ body: typeof GetChunk.infer }>(
  async (h3) => {
    const body = await readDropValidatedBody(h3, GetChunk);

    const context = await contextManager.fetchContext(body.context);
    if (!context)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid download context.",
      });

    const streamFiles = [];

    for (const file of body.files) {
      const manifestFile = context.manifest[file.filename];
      if (!manifestFile)
        throw createError({
          statusCode: 400,
          statusMessage: `Unknown file: ${file.filename}`,
        });

      const start = manifestFile.lengths
        .slice(0, file.chunkIndex)
        .reduce((a, b) => a + b, 0);
      const end = start + manifestFile.lengths[file.chunkIndex];

      streamFiles.push({ filename: file.filename, start, end });
    }

    setHeader(
      h3,
      "Content-Lengths",
      streamFiles.map((e) => e.end - e.start).join(","),
    ); // Non-standard header, but we're cool like that 😎

    for (const file of streamFiles) {
      const gameReadStream = await libraryManager.readFile(
        context.libraryId,
        context.libraryPath,
        context.versionName,
        file.filename,
        { start: file.start, end: file.end },
      );
      if (!gameReadStream)
        throw createError({
          statusCode: 500,
          statusMessage: "Failed to create read stream",
        });
      await gameReadStream.pipeTo(
        new WritableStream({
          write(chunk) {
            h3.node.res.write(chunk);
          },
        }),
      );
    }

    await h3.node.res.end();

    return;
  },
);
