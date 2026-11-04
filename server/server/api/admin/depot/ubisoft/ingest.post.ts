import { createError, defineEventHandler, readBody } from "h3";
import aclManager from "~/server/internal/acls";
import { queueLocalUbisoftIngest } from "../../../../utils/depot/ingest-queue";

type IngestUbisoftBody = {
  /** Demux numeric product id, as listed by the Ubisoft library route. */
  productId?: string | number;
  /** Specific manifest SHA-1; the entitlement's latest when omitted. */
  manifestSha1?: string;
  /** Chunk language selector from the install manifest; default "en-US". */
  language?: string;
  /** Product title as shown in the library; recorded with the release. */
  gameTitle?: string;
};

export default defineEventHandler(async (event) => {
  if (!(await aclManager.allowSystemACL(event, ["depot:new"])))
    throw createError({ statusCode: 403, statusMessage: "Admin only" });
  const body = await readBody<IngestUbisoftBody>(event);
  const productId =
    typeof body?.productId === "number"
      ? body.productId
      : typeof body?.productId === "string" &&
          /^\d+$/.test(body.productId.trim())
        ? Number(body.productId.trim())
        : NaN;
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "A numeric Ubisoft product id is required",
    });
  }
  const manifestSha1 =
    typeof body?.manifestSha1 === "string" ? body.manifestSha1.trim() : "";
  if (manifestSha1 && !/^[0-9a-fA-F]{40}$/.test(manifestSha1)) {
    throw createError({
      statusCode: 400,
      statusMessage: "manifestSha1 must be a 40-character hex SHA-1",
    });
  }
  const language =
    typeof body?.language === "string" &&
    /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(body.language.trim())
      ? body.language.trim()
      : undefined;
  if (
    body?.gameTitle !== undefined &&
    (typeof body.gameTitle !== "string" || body.gameTitle.length > 200)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "gameTitle must be a string of at most 200 characters",
    });
  }

  return await queueLocalUbisoftIngest(
    productId,
    manifestSha1 || undefined,
    language,
    body?.gameTitle,
  );
});
