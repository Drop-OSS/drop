import { logger } from "../logging";

export type TaskRunContext = {
  progress: (progress: number) => void;
  logger: typeof logger;
};

export function wrapTaskContext(
  context: TaskRunContext,
  options: { min: number; max: number; prefix: string },
): TaskRunContext {
  const child = context.logger.child({
    prefix: options.prefix,
  });

  return {
    progress(progress) {
      if (progress > 100 || progress < 0) {
        logger.warn("[wrapTaskContext] progress must be between 0 and 100");
      }

      // I was too tired to figure this out
      // https://stackoverflow.com/a/929107
      const oldRange = 100;
      const newRange = options.max - options.min;
      const adjustedProgress = (progress * newRange) / oldRange + options.min;
      return context.progress(adjustedProgress);
    },
    logger: child,
  };
}


// /**
//  * Create a log message with a timestamp in the format YYYY-MM-DD HH:mm:ss.SSS UTC
//  * @param message
//  * @returns
//  */
// function msgWithTimestamp(message: string): string {
//   const now = new Date();

//   const pad = (n: number, width = 2) => n.toString().padStart(width, "0");

//   const year = now.getUTCFullYear();
//   const month = pad(now.getUTCMonth() + 1);
//   const day = pad(now.getUTCDate());

//   const hours = pad(now.getUTCHours());
//   const minutes = pad(now.getUTCMinutes());
//   const seconds = pad(now.getUTCSeconds());
//   const milliseconds = pad(now.getUTCMilliseconds(), 3);

//   const log: typeof TaskLog.infer = {
//     timestamp: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} UTC`,
//     message,
//   };
//   return JSON.stringify(log);
// }
