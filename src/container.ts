import { createContainer, InjectionMode, asValue, asClass } from "awilix";

import {
  JiraConfig,
  JiraAgileService,
  JiraApiV2Service,
  JiraApiV3Service,
} from "./modules/jira";
import { RallyConfig, RallyService } from "./modules/rally";
import { logger } from "./modules/shared";
import App from "./app";

interface ICradle {
  app: App;
  logger: typeof logger;
  rallyConfig: RallyConfig;
  rallyService: RallyService;
  jiraConfig: JiraConfig;
  jiraApiV2Service: JiraApiV2Service;
  jiraApiV3Service: JiraApiV3Service;
  jiraAgileService: JiraAgileService;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.PROXY,
});

container.register({
  app: asClass(App),
  logger: asValue(logger),
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
  jiraApiV2Service: asClass(JiraApiV2Service),
  jiraApiV3Service: asClass(JiraApiV3Service),
  jiraAgileService: asClass(JiraAgileService),
});

export default container;
