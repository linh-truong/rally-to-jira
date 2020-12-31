import axios, { AxiosInstance } from "axios";

import { JiraConfig } from "./jira.type";

export class JiraAgileService {
  jiraConfig: JiraConfig;
  client: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    this.client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/agile/1.0`,
      auth: {
        username: this.jiraConfig.username,
        password: this.jiraConfig.apiToken,
      },
    });
  }

  getBoards = async (projectKeyOrId: string) => {
    const { data } = await this.client.get<{
      datamaxResults: number;
      startAt: number;
      total: number;
      isLast: boolean;
      values: {
        id: number;
        self: string;
        name: string;
        type: string;
      }[];
    }>("board", { params: { projectKeyOrId } });
    return data;
  };

  createSprint = async (input: {
    name: string;
    originBoardId: number;
    startDate?: string;
    endDate?: string;
    goal?: string;
  }) => {
    const { data } = await this.client.post<{
      id: number;
      self: string;
      state: string;
      name: string;
      originBoardId: number;
      startDate?: string;
      endDate?: string;
      goal?: string;
    }>("sprint", input);
    return data;
  };
}
