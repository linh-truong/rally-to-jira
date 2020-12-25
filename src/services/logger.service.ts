import pino from "pino";

const logger = pino({
  prettyPrint: {
    colorize: true,
  },
  base: null,
});

export default logger;
