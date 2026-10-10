import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import pluginManager from "~/server/internal/plugins";
import type { PluginManifest } from "~/server/internal/plugins";

const InstallBundle = type({
  "manifest?": {
    id: "string>0",
    name: "string>0",
    version: "string>0",
    "apiVersion?": "number",
    "entry?": "string",
    "clientEntry?": "string",
    "capabilities?": "string[]",
    "checksum?": "string",
    "files?": "Record<string, string>",
    "signature?": "string",
    "server?": "object",
    "client?": "object",
  },
  "entry?": "string",
  "files?": "Record<string, string>",
  "format?": "string",
  "url?": "string>0",
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, []);
  if (!allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Admin privileges required to install plugins",
    });
  }

  const body = await readDropValidatedBody(h3, InstallBundle);
  try {
    if (body.url) {
      await pluginManager.installFromUrl(body.url);
    } else {
      const payload = body.files ?? body.entry;
      if (!payload || !body.manifest) {
        throw new Error(
          "Plugin bundle must provide either 'url', or 'manifest' with 'files'/'entry'",
        );
      }
      await pluginManager.installBundle(
        body.manifest as PluginManifest,
        payload,
      );
    }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: String(err) });
  }

  return { success: true, plugins: pluginManager.listPlugins() };
});
