import { createContainer, InjectionMode, asValue, asClass } from "awilix";

import logger from "./services/logger.service";
import RallyService from "./services/rally.service";

export interface RallyConfig {
  apiBaseURL: string;
  apiKey: string;
  username: string;
  password: string;
  projectId: string;
}

interface ICradle {
  logger: typeof logger;
  rallyConfig: RallyConfig;
  rallyService: RallyService;
}

const container = createContainer<ICradle>({
  injectionMode: InjectionMode.PROXY,
});

container.register({
  logger: asValue(logger),
  rallyConfig: asValue({
    apiBaseURL: process.env.RALLY_API_BASE_URL,
    apiKey: process.env.RALLY_API_KEY,
    username: process.env.RALLY_USERNAME,
    password: process.env.RALLY_PASSWORD,
    projectId: process.env.RALLY_PROJECT_ID,
  }),
  rallyService: asClass(RallyService),
});

export default container;
