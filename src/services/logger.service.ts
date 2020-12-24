import pino from "pino";

const logger = pino({
  prettyPrint: true,
  base: null,
});

export default logger;
