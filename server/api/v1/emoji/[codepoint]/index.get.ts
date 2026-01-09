import aclManager from "~/server/internal/acls";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.hasACL(h3, [
    "system:setup",
    "user:emoji:read",
  ]);
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: "Requires authentication",
    });

  const codepoint = getRouterParam(h3, "codepoint");
  if (!codepoint) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing codepoint parameter",
    });
  }

  // Get the emoji SVG from server assets
  const asset = await useStorage("assets:twemoji").getItemRaw(
    `${codepoint}.svg`,
  );

  if (!asset) {
    throw createError({
      statusCode: 404,
      statusMessage: "Emoji not found",
    });
  }

  // Set proper content type for SVG
  setResponseHeader(h3, "Content-Type", "image/svg+xml");
  setResponseHeader(h3, "Cache-Control", "private, max-age=31536000");

  return asset;
});
