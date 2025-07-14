import pino from "pino";
import "pino-pretty";

export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

logger.child({});
