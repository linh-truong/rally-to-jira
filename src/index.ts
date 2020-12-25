import * as dotenv from "dotenv";
dotenv.config();
import _ from "lodash";

import container from "./container";

const main = async () => {
  const logger = container.cradle.logger;
  try {
    const jiraService = container.cradle.jiraService;
    const { id: projectId } = await jiraService.createProject({
      name: "Test 7",
      key: "TEST7",
    });
    const issueTypes = await jiraService.getIssueTypesByProjectId(projectId);
    const issueTypeByName = _.keyBy(issueTypes, (item) => item.name);

    const data = await jiraService.bulkCreateIssue([
      {
        fields: {
          summary: "Story 1",
          issuetype: { id: issueTypeByName["Story"].id },
          project: { id: projectId.toString() },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    text: "Order entry fails when selecting supplier.",
                    type: "text",
                  },
                ],
              },
            ],
          },
          labels: ["bugfix", "blitz_test"],
        },
      },
    ]);

    logger.info(data);
  } catch (err) {
    logger.error(err);
  }
  process.exit();
};

main();
