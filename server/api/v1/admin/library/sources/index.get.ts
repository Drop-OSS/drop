import type { LibraryModel } from "~/prisma/client/models";
import aclManager from "~/server/internal/acls";
import libraryManager from "~/server/internal/library";

export type WorkingLibrarySource = LibraryModel & { working: boolean };

/**
 * Fetch all library sources on this instance
 */
export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, [
    "library:sources:read",
    "setup",
  ]);
  if (!allowed) throw createError({ statusCode: 403 });

  const sources = await libraryManager.fetchLibraries();

  // Fetch other library data here

  return sources;
});
