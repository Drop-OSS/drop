import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import objectHandler from "~/server/internal/objects";
import { handleFileUpload } from "~/server/internal/utils/handlefileupload";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["company:update"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const companyId = getRouterParam(h3, "id")!;
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
  });

  if (!company)
    throw createError({ statusCode: 400, statusMessage: "Invalid company id" });

  const result = await handleFileUpload(h3, {}, ["internal:read"], 1);
  if (!result)
    throw createError({
      statusCode: 400,
      statusMessage: "File upload required (multipart form)",
    });

  const [ids,, pull, dump] = result;
  const id = ids.at(0);
  if (!id)
    throw createError({
      statusCode: 400,
      statusMessage: "Upload at least one file.",
    });

  try {
    await objectHandler.deleteAsSystem(company.mLogoObjectId);
    await prisma.company.update({
      where: {
        id: companyId,
      },
      data: {
        mLogoObjectId: id,
      },
    });
    await pull();
  } catch {
    await dump();
  }

  return { id: id };
});
