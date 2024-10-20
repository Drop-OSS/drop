import { defineClientEventHandler } from "~/server/internal/clients/event-handler";

export default defineClientEventHandler(async (h3) => {
  const query = getQuery(h3);
  const clientId = query.id?.toString();
  if (!clientId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing id in query",
    });

  const certificate = await h3.context.ca.fetchClientCertificate(clientId);
  if (!certificate) {
    // Either it doesn't exist or it's blacklisted
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or blacklisted clientId",
    });
  }

  return {
    certificate: certificate.cert,
  };
});
