import * as dotenv from "dotenv";
dotenv.config();

import container from "./container";

const main = async () => {
  const logger = container.cradle.logger;
  try {
    const jiraService = container.cradle.jiraService;
    const project = await jiraService.createProjectProject({
      projectTypeKey: "software", // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-post
      projectTemplateKey:
        "com.pyxis.greenhopper.jira:gh-simplified-agility-scrum",
      name: "Test 5",
      assigneeType: "UNASSIGNED",
      key: "TEST5",
    });
    logger.info(project);
  } catch (err) {
    logger.error(err);
  }
  process.exit();
};

main();
