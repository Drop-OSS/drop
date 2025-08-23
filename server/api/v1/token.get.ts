import aclManager from "~/server/internal/acls"

export default defineEventHandler(async (h3) => {
    const acls = await aclManager.fetchAllACLs(h3);
    return acls;
})