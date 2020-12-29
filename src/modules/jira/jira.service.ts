import axios, { AxiosInstance } from "axios";

import {
  IssueField,
  JiraConfig,
  ProjectIssueType,
  WorkflowStatus,
} from "./jira.type";

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

interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  assigneeType?: string;
  projectTemplateKey?: string;
  projectTypeKey?: string;
}

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

export interface CreateIssueLinkInput {
  outwardIssue: { key: string };
  inwardIssue: { key: string };
  type: { name: string };
}

export class JiraService {
  jiraConfig: JiraConfig;
  client: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    this.client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/3`,
      auth: {
        username: this.jiraConfig.username,
        password: this.jiraConfig.apiToken,
      },
    });
  }

  getAllProjects = async () => {
    const { data } = await this.client.get<{ id: string }[]>("project");
    return data;
  };

  createProject = async (input: CreateProjectInput) => {
    const { data } = await this.client.post<{
      self: string;
      id: number;
      key: string;
    }>("project", {
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

  deleteProject = async (projectId: string) => {
    const { data } = await this.client.delete(`project/${projectId}`);
    return data;
  };

  cleanUpProjects = async () => {
    const projects = await this.getAllProjects();
    await Promise.all(
      projects.map((project) => this.deleteProject(project.id))
    );
  };

  getAllWorkflowStatuses = async () => {
    const { data } = await this.client.get<WorkflowStatus[]>("status");
    return data;
  };

  getWorkflowStatusesByProjectId = async (projectId: string) => {
    const { data } = await this.client.get<WorkflowStatus[]>("status");
    return data.filter((item) => item.scope.project.id === projectId);
  };

  getIssueTypesByProjectId = async (projectId: string) => {
    const { data } = await this.client.get<{
      projects: {
        self: string;
        id: string;
        key: string;
        name: string;
        issuetypes: ProjectIssueType[];
      }[];
    }>("issue/createmeta");
    const targetProject = data.projects.find((item) => item.id === projectId);
    return targetProject?.issuetypes || [];
  };

  getIssueFields = async () => {
    const { data } = await this.client.get<IssueField[]>("field");
    return data;
  };

  bulkCreateIssueWithApiV2 = async (input: BulkCreateIssueInput) => {
    const { data } = await this.client.post<BulkCreateIssueOutput>(
      "issue/bulk",
      {
        issueUpdates: input.map((item) => ({
          ...item,
          update: {},
        })),
      },
      { baseURL: `${this.jiraConfig.apiBaseURL}/2` }
    );
    return data;
  };

  createIssueLink = async (input: CreateIssueLinkInput) => {
    const { data } = await this.client.post("issueLink", input);
    return data;
  };
}
