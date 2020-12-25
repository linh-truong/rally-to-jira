import * as dotenv from "dotenv";
dotenv.config();

import container from "./container";

const main = async () => {
  const logger = container.cradle.logger;
  try {
    const jiraService = container.cradle.jiraService;
    const project = await jiraService.createProject({
      name: "Test 5",
      key: "TEST5",
    });
    logger.info(project);
  } catch (err) {
    logger.error(err);
  }
  process.exit();
};

main();
