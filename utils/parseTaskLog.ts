import type { TaskLog } from "~/server/internal/tasks";

export function parseTaskLog(logStr: string): typeof TaskLog.infer {
  const log = JSON.parse(logStr);

  return {
    message: log.msg,
    timestamp: log.time,
  };
}
