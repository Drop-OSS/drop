import aclManager from "~/server/internal/acls"
import prisma from "~/server/internal/db/database";

export default defineEventHandler(async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, ["import:version:read"]);
    if(!allowed) throw createError({statusCode: 403});

    const userPlatforms = await prisma.userPlatform.findMany({});

    return userPlatforms;
})
