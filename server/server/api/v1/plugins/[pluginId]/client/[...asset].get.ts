import { createReadStream } from "node:fs";
import path from "node:path";
import { getRouterParam, createError, setResponseHeader, sendStream } from "h3";
import pluginManager from "~/server/internal/plugins";

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export default defineEventHandler(async (event) => {
  const pluginId = getRouterParam(event, "pluginId");
  const asset = getRouterParam(event, "asset");

  if (!pluginId || !asset) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing pluginId or asset path",
    });
  }

  const filePath = await pluginManager.getClientAssetPath(pluginId, asset);
  if (!filePath) {
    throw createError({
      statusCode: 404,
      statusMessage: `Plugin asset '${asset}' not found for plugin '${pluginId}'`,
    });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  setResponseHeader(event, "Content-Type", mimeType);
  setResponseHeader(event, "Cache-Control", "public, max-age=3600");

  return sendStream(event, createReadStream(filePath));
});
