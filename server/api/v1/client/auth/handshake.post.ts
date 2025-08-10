import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import clientHandler from "~/server/internal/clients/handler";
import { useCertificateAuthority } from "~/server/plugins/ca";

const HandshakeBody = type({
  clientId: "string",
  token: "string",
}).configure(throwingArktype);

/**
 * Client route to complete handshake, after the user has authorize it. 
 */
export default defineEventHandler<{ body: typeof HandshakeBody.infer }>(
  async (h3) => {
    const body = await readDropValidatedBody(h3, HandshakeBody);
    const clientId = body.clientId;
    const token = body.token;

    const metadata = await clientHandler.fetchClient(clientId);
    if (!metadata)
      throw createError({
        statusCode: 403,
        statusMessage: "Invalid client ID",
      });
    if (!metadata.authToken || !metadata.userId)
      throw createError({
        statusCode: 400,
        statusMessage: "Un-authorized client ID",
      });
    if (metadata.authToken !== token)
      throw createError({
        statusCode: 403,
        statusMessage: "Invalid token",
      });

    const certificateAuthority = useCertificateAuthority();
    const bundle = await certificateAuthority.generateClientCertificate(
      clientId,
      metadata.data.name,
    );

    const client = await clientHandler.finialiseClient(clientId);
    await certificateAuthority.storeClientCertificate(clientId, bundle);

    return {
      private: bundle.priv,
      certificate: bundle.cert,
      id: client.id,
    };
  },
);
