import { createContainer, InjectionMode, asValue, asClass } from "awilix";
import { customAlphabet } from "nanoid";
import TurndownService from "turndown";

import { JiraConfig, JiraService } from "./modules/jira";
import { RallyConfig, RallyService } from "./modules/rally";
import { logger } from "./modules/shared";
import App from "./app";

interface ICradle {
  app: App;
  logger: typeof logger;
  idGenerator: () => string;
  turndownService: TurndownService;
  rallyConfig: RallyConfig;
  rallyService: RallyService;
  jiraConfig: JiraConfig;
  jiraService: JiraService;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.PROXY,
});

container.register({
  app: asClass(App),
  logger: asValue(logger),
  idGenerator: asValue(customAlphabet("1234567890", 7)),
  turndownService: asValue(new TurndownService()),
  rallyConfig: asValue({
    apiBaseURL: process.env.RALLY_API_BASE_URL,
    apiKey: process.env.RALLY_API_KEY,
    projectId: process.env.RALLY_PROJECT_ID,
  }),
  rallyService: asClass(RallyService),
  jiraConfig: asValue({
    apiBaseURL: process.env.JIRA_API_BASE_URL,
    username: process.env.JIRA_USERNAME,
    apiToken: process.env.JIRA_API_TOKEN,
    leadAccountId: process.env.JIRA_LEAD_ACCOUNT_ID,
  }),
  jiraService: asClass(JiraService),
});

export default container;
