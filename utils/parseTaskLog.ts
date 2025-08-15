import type { TaskLog } from "~/server/internal/tasks";

export function parseTaskLog(
  logStr?: string | undefined,
): typeof TaskLog.infer {
  if (!logStr) return { message: "", timestamp: "" };
  const log = JSON.parse(logStr);

  return {
    message: log.msg,
    timestamp: log.time,
  };
}
