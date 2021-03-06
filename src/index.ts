import * as dotenv from "dotenv";
dotenv.config();

import container from "./container";

const main = async () => {
  const logger = container.cradle.logger;
  try {
    const app = container.cradle.app;
    await app.run();
  } catch (err) {
    logger.error(err);
  }
  process.exit();
};

main();
