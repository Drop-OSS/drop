import clientHandler from "~/server/internal/clients/handler";
import { useGlobalCertificateAuthority } from "~/server/plugins/ca";

export default defineEventHandler(async (h3) => {
  const body = await readBody(h3);
  const clientId = body.clientId;
  const token = body.token;
  if (!clientId || !token)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing token or client ID from body",
    });

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

  const ca = useGlobalCertificateAuthority();
  const bundle = await ca.generateClientCertificate(
    clientId,
    metadata.data.name
  );

  const client = await clientHandler.finialiseClient(clientId);
  await ca.storeClientCertificate(clientId, bundle);

  return {
    private: bundle.priv,
    certificate: bundle.cert,
    id: client.id,
  };
});
