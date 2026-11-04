import { defineEventHandler, getHeader, getRouterParam } from "h3";
import aclManager from "~/server/internal/acls";
import { systemConfig } from "~/server/internal/config/sys-conf";
import { depotRootFor } from "~/server/utils/depot/paths";
import {
  requireImportSession,
  storeImportedObject,
} from "~/server/utils/import/session";

/**
 * Upload one missing CAS object: the raw bytes whose SHA-256 names them,
 * declared in `x-content-sha256`. The digest is recomputed from the arriving
 * stream and the object lands where the store's own layout puts it - the
 * client never names a file path here, only content.
 */
export default defineEventHandler(async (h3) => {
  if (!(await aclManager.allowSystemACL(h3, ["import:game:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const id = getRouterParam(h3, "sessionid")!;
  const session = requireImportSession(id);
  const sha256 = (getHeader(h3, "x-content-sha256") ?? "").toLowerCase();

  // The request stream is the body: nothing is buffered, the hasher and the
  // object file see every byte as it arrives.
  const stream = h3.node.req;
  if (stream.readableEnded || stream.destroyed)
    throw createError({
      statusCode: 400,
      statusMessage: "A raw object body is required",
    });

  return storeImportedObject(
    depotRootFor(systemConfig.getDataFolder()),
    session,
    sha256,
    stream,
  );
});
