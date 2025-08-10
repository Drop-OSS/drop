import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import clientHandler from "~/server/internal/clients/handler";

const AuthorizeBody = type({
  id: "string",
}).configure(throwingArktype);

/**
 * Finalize the authorization for a client
 */
export default defineEventHandler<{ body: typeof AuthorizeBody.infer }>(
  async (h3) => {
    const userId = await aclManager.getUserIdACL(h3, []);
    if (!userId) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, AuthorizeBody);
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

    const token = await clientHandler.generateAuthToken(clientId);

    return {
      redirect: `drop://handshake/${clientId}/${token}`,
      token: `${clientId}/${token}`,
    };
  },
);
