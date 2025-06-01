import type { Library } from "~/prisma/client";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export type WorkingLibrarySource = Library & { working: boolean };

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["library:sources:read"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const sources = await libraryManager.fetchLibraries();

  // Fetch other library data here

  return sources;
});
