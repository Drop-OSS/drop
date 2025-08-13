import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";

const CodeAuthorize = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Authorize code by client ID, and send token via WS to client
 */
export default defineEventHandler<{ body: typeof CodeAuthorize.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, []);
    if (!userId) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, CodeAuthorize);
    const clientId = body.id;

    const client = await clientHandler.fetchClient(clientId);
    if (!client)
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid or expired client ID.",
      });

    if (client.userId != userId)
      throw createError({
        statusCode: 403,
        statusMessage: "Not allowed to authorize this client.",
      });

    if (!client.peer)
      throw createError({
        statusCode: 500,
        statusMessage: "No client listening for authorization.",
      });

    const token = await clientHandler.generateAuthToken(clientId);

    await clientHandler.sendAuthToken(clientId, token);

    return;
  },
);
