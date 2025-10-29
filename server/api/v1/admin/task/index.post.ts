import { type } from "arktype";
import { readDropValidatedBody, throwingArktype } from "~~/server/arktype";
import aclManager from "~~/server/internal/acls";
import taskHandler from "~~/server/internal/tasks";
import { TASK_GROUPS } from "~~/server/internal/tasks/group";

const StartTask = type({
  taskGroup: type.enumerated(...TASK_GROUPS),
}).configure(throwingArktype);

export default defineEventHandler(async (h3) => {
  const allowed = await aclManager.allowSystemACL(h3, ["task:start"]);
  if (!allowed) throw createError({ statusCode: 403 });

  const body = await readDropValidatedBody(h3, StartTask);

  const task = await taskHandler.runTaskGroupByName(body.taskGroup);
  if (!task)
    throw createError({
      statusCode: 500,
      message: "Could not start task.",
    });
  return { id: task };
});
