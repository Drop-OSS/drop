import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import { defineClientEventHandler } from "~/server/internal/clients/event-handler";
import contextManager from "~/server/internal/downloads/coordinator";

const CreateContext = type({
  game: "string",
  version: "string",
}).configure(throwingArktype);

export default defineClientEventHandler(async (h3) => {
  const body = await readDropValidatedBody(h3, CreateContext);

  const context = await contextManager.createContext(body.game, body.version);
  if (!context)
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid game or version",
    });

  return {context};
});
