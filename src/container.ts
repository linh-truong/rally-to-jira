import { createContainer, InjectionMode, asValue, asClass } from "awilix";

import logger from "./services/logger.service";
import RallyService from "./services/rally.service";
import JiraService from "./services/jira.service";

export interface RallyConfig {
  apiBaseURL: string;
  apiKey: string;
  projectId: string;
}

export interface JiraConfig {
  apiBaseURL: string;
  username: string;
  apiToken: string;
  leadAccountId: string;
}

interface ICradle {
  logger: typeof logger;
  rallyConfig: RallyConfig;
  rallyService: RallyService;
  jiraConfig: JiraConfig;
  jiraService: JiraService;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.PROXY,
});

container.register({
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
  jiraService: asClass(JiraService),
});

export default container;
