import aclManager from "~/server/internal/acls"

export default defineEventHandler(async (h3) => {
    const allowed = await aclManager.allowSystemACL(h3, []);
    if(!allowed) return false;
    return true;
})