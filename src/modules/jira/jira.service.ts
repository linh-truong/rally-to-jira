import axios, { AxiosInstance } from "axios";
import FormData from "form-data";

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

interface CreateIssueLinkInput {
  outwardIssue: { key: string };
  inwardIssue: { key: string };
  type: { name: string };
}

interface AddIssueAttachmentsInput {
  issueIdOrKey: string;
  attachments: {
    content: string;
    filename: string;
  }[];
}

export class JiraService {
  jiraConfig: JiraConfig;
  restV2Client: AxiosInstance;
  restV3Client: AxiosInstance;
  agileClient: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    const auth = {
      username: this.jiraConfig.username,
      password: this.jiraConfig.apiToken,
    };
    this.restV2Client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/api/2`,
      auth,
    });
    this.restV3Client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/api/3`,
      auth,
    });
    this.agileClient = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/agile/1.0`,
      auth,
    });
  }

  getAllProjects = async () => {
    const { data } = await this.restV3Client.get<{ id: string }[]>("project");
    return data;
  };

  createProject = async (input: CreateProjectInput) => {
    const { data } = await this.restV3Client.post<{
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
    const { data } = await this.restV3Client.delete(`project/${projectId}`);
    return data;
  };

  cleanUpProjects = async () => {
    const projects = await this.getAllProjects();
    await Promise.all(
      projects.map((project) => this.deleteProject(project.id))
    );
  };

  getAllWorkflowStatuses = async () => {
    const { data } = await this.restV3Client.get<WorkflowStatus[]>("status");
    return data;
  };

  getWorkflowStatusesByProjectId = async (projectId: string) => {
    const { data } = await this.restV3Client.get<WorkflowStatus[]>("status");
    return data.filter((item) => item.scope.project.id === projectId);
  };

  getIssueTypesByProjectId = async (projectId: string) => {
    const { data } = await this.restV3Client.get<{
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
    const { data } = await this.restV3Client.get<IssueField[]>("field");
    return data;
  };

  bulkCreateIssue = async (input: BulkCreateIssueInput) => {
    const { data } = await this.restV2Client.post<BulkCreateIssueOutput>(
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

  createIssueLink = async (input: CreateIssueLinkInput) => {
    const { data } = await this.restV3Client.post("issueLink", input);
    return data;
  };

  addIssueAttachments = async (input: AddIssueAttachmentsInput) => {
    const form = new FormData();
    input.attachments.forEach((item) => {
      form.append("file", Buffer.from(item.content, "base64"), item.filename);
    });
    const { data } = await this.restV3Client.post(
      `issue/${input.issueIdOrKey}/attachments`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          "X-Atlassian-Token": "no-check",
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    return data;
  };

  getBoards = async (projectKeyOrId: string) => {
    const { data } = await this.agileClient.get<{
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
    const { data } = await this.agileClient.post<{
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
