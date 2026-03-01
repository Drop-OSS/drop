import aclManager from "~/server/internal/acls";
import prisma from "~/server/internal/db/database";
import taskHandler from "~/server/internal/tasks";
import type { TaskGroup } from "~/server/internal/tasks/group";

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
    select: {
      id: true,
      name: true,
      actions: true,
      error: true,
      success: true,
    },
    take: 32,
  });
  const dailyTasks = await taskHandler.dailyTasks();
  const weeklyTasks = await taskHandler.weeklyTasks();
  const other: TaskGroup[] = ["import:check-integrity"];

  return { runningTasks, historicalTasks, dailyTasks, weeklyTasks, other };
});
