import clientHandler from "~/server/internal/clients/handler";

export default defineEventHandler(async (h3) => {
  const query = getQuery(h3);
  const code = query.code?.toString()?.toUpperCase();
  if (!code)
    throw createError({
      statusCode: 400,
      statusMessage: "Code required in query params.",
    });

  const clientId = await clientHandler.fetchClientIdByCode(code);
  if (!clientId)
    throw createError({ statusCode: 400, statusMessage: "Invalid code." });

  return clientId;
});
