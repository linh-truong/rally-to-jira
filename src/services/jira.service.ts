import axios, { AxiosInstance } from "axios";

import { JiraConfig } from "../container";

interface CreateScrumProjectInput {
  name: string;
  key: string;
  description?: string;
  assigneeType?: string;
  projectTemplateKey?: string;
  projectTypeKey?: string;
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

  createProject = async (input: CreateScrumProjectInput) => {
    const { data } = await this.client.post("project", {
      ...input,
      projectTypeKey: input.projectTypeKey || "software", // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/#api-rest-api-3-project-post
      projectTemplateKey:
        input.projectTemplateKey ||
        "com.pyxis.greenhopper.jira:gh-simplified-agility-scrum",
      assigneeType: input.assigneeType || "UNASSIGNED",
      leadAccountId: this.jiraConfig.leadAccountId,
    });
    return data;
  };
}

export default JiraService;
