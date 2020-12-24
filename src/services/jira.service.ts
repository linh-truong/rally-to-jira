import axios, { AxiosInstance } from "axios";

import { JiraConfig } from "../container";

interface CreateScrumProjectInput {
  description?: string;
  projectTemplateKey: string;
  name: string;
  assigneeType: string;
  projectTypeKey: string;
  key: string;
}

class JiraService {
  jiraConfig: JiraConfig;
  client: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    this.client = axios.create({
      baseURL: this.jiraConfig.apiBaseURL,
      auth: {
        username: this.jiraConfig.username,
        password: this.jiraConfig.apiToken,
      },
    });
  }

  getAllProjects = async () => {
    const { data } = await this.client.get("project");
    return data;
  };

  createProjectProject = async (input: CreateScrumProjectInput) => {
    const { data } = await this.client.post("project", {
      ...input,
      leadAccountId: this.jiraConfig.leadAccountId,
    });
    return data;
  };
}

export default JiraService;
