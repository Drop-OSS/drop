import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import * as jdenticon from "jdenticon";
import { ObjectTransactionalHandler } from "~/server/internal/objects/transactional";
import prisma from "~/server/internal/db/database";
import { MetadataSource } from "~/prisma/client/enums";

const CompanyCreate = type({
  name: "string",
  description: "string",
  website: "string",
}).configure(throwingArktype);

/**
 * Create a new company on this instance
 */
export default defineEventHandler<{ body: typeof CompanyCreate.infer }>(
  async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["company:create"]);
    if (!allowed) throw createError({ statusCode: 403 });

    const body = await readDropValidatedBody(h3, CompanyCreate);
    const obj = new ObjectTransactionalHandler();
    const [register, pull, _] = obj.new({}, ["internal:read"]);

    const icon = jdenticon.toPng(body.name, 512);
    const logoId = register(icon);

    const banner = jdenticon.toPng(body.description, 1024);
    const bannerId = register(banner);

    const company = await prisma.company.create({
      data: {
        metadataSource: MetadataSource.Manual,
        metadataId: crypto.randomUUID(),
        metadataOriginalQuery: "",

        mName: body.name,
        mShortDescription: body.description,
        mDescription: "",
        mLogoObjectId: logoId,
        mBannerObjectId: bannerId,
        mWebsite: body.website,
      },
    });

    await pull();

    return company;
  },
);
