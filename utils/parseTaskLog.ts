import type { TaskLog } from "~/server/internal/tasks";

const labelNumberMap = {
  100: "silent",
  60: "fatal",
  50: "error",
  40: "warn",
  30: "info",
  20: "debug",
  10: "trace",
  0: "off",
};

export function parseTaskLog(
  logStr?: string | undefined,
): typeof TaskLog.infer {
  if (!logStr) return { message: "", timestamp: "", level: "" };
  const log = JSON.parse(logStr);

  if (typeof log.level === "number") {
    log.level = labelNumberMap[log.level as keyof typeof labelNumberMap] as string;
  }

  return {
    message: log.msg,
    timestamp: log.time,
    level: log.level
  };
}
