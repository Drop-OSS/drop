import pino from "pino";
import pinoPretty from "pino-pretty";

// call pino pretty so that it isn't excluded from the build
pinoPretty();

export const logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});
