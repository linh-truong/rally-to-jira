import axios, { AxiosInstance } from "axios";

import { JiraConfig } from "./jira.type";

export const defaultWorkflowStatusNames = {
  todo: "To do",
  inProgress: "In Progress",
  done: "Done",
};

export const defaultIssueTypeNames = {
  story: "Story",
  task: "Task",
  bug: "Bug",
  epic: "Epic",
  subtask: "Subtask",
};

interface CreateIssueInput {
  fields: {
    summary: string;
    issuetype: {
      id: string;
    };
    project: {
      id: string;
    };
    description: string;
    labels: string[];
    [field: string]: any;
  };
}

type BulkCreateIssueInput = CreateIssueInput[];

export interface BulkCreateIssueOutput {
  issues: {
    id: string;
    key: string;
    self: string;
    transition?: {
      status: number;
      errorCollection: {
        errorMessages: any[];
        errors: any;
      };
    };
  }[];
  errors: any[];
}

export class JiraApiV2Service {
  jiraConfig: JiraConfig;
  client: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    this.client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/api/2`,
      auth: {
        username: this.jiraConfig.username,
        password: this.jiraConfig.apiToken,
      },
    });
  }

  bulkCreateIssue = async (input: BulkCreateIssueInput) => {
    const { data } = await this.client.post<BulkCreateIssueOutput>(
      "issue/bulk",
      {
        issueUpdates: input.map((item) => ({
          ...item,
          update: {},
        })),
      }
    );
    return data;
  };
}
