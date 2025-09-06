import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import type { TaskMessage } from "~/server/internal/tasks";
import taskHandler from "~/server/internal/tasks";

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["task:read"]);
  if (!allowed) throw createError({ statusCode: 403 });
  const allAcls = await aclManager.fetchAllACLs(h3);
  if (!allAcls)
    throw createError({
      statusCode: 403,
      message: "Somehow no ACLs on authenticated request.",
    });

  const runningTasks = (await taskHandler.runningTasks()).map((e) => e.id);
  const historicalTasks = (await prisma.task.findMany({
    where: {
      OR: [
        {
          acls: { hasSome: allAcls },
        },
        {
          acls: { isEmpty: true },
        },
      ],
    },
    orderBy: {
      ended: "desc",
    },
    take: 10,
  })) as Array<TaskMessage>;
  const dailyTasks = await taskHandler.dailyTasks();
  const weeklyTasks = await taskHandler.weeklyTasks();

  return { runningTasks, historicalTasks, dailyTasks, weeklyTasks };
});
