import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~/server/arktype";
import aclManager from "~/server/internal/acls";
import taskHandler from "~/server/internal/tasks";
import type { TaskGroup } from "~/server/internal/tasks/group";
import { taskGroups } from "~/server/internal/tasks/group";

const StartTask = type({
  taskGroup: type("string"),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["task:start"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, StartTask);
  const taskGroup = body.taskGroup as TaskGroup;
  if (!taskGroups[taskGroup])
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid task group.",
    });

  const task = await taskHandler.runTaskGroupByName(taskGroup);
  if (!task)
    throw createError({
      statusCode: 500,
      statusMessage: "Could not start task.",
    });
  return { id: task };
});
