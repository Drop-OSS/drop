import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["task:read"]);
  if (!allowed) throw createError({ statusCode: 403 });
  const allAcls = await aclManager.fetchAllACLs(h3);
  if (!allAcls)
    throw createError({
      statusCode: 403,
      statusMessage: "Somehow no ACLs on authenticated request.",
    });

  const runningTasks = (await taskHandler.runningTasks()).map((e) => e.id);
  const historicalTasks = await prisma.task.findMany({
    where: {
      acls: { hasSome: allAcls },
    },
    orderBy: {
      ended: "desc",
    },
    take: 10,
  });

  return { runningTasks, historicalTasks };
});
