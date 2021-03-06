import axios, { AxiosInstance } from "axios";
import FormData from "form-data";

import {
  IssueField,
  JiraConfig,
  ProjectIssueType,
  WorkflowStatus,
} from "./jira.type";

interface CreateProjectInput {
  name: string;
  key: string;
  description?: string;
  assigneeType?: string;
  projectTemplateKey?: string;
  projectTypeKey?: string;
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

export class JiraApiV3Service {
  jiraConfig: JiraConfig;
  client: AxiosInstance;

  constructor(options: { jiraConfig: JiraConfig }) {
    this.jiraConfig = options.jiraConfig;
    this.client = axios.create({
      baseURL: `${this.jiraConfig.apiBaseURL}/api/3`,
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

  createIssueLink = async (input: CreateIssueLinkInput) => {
    const { data } = await this.client.post("issueLink", input);
    return data;
  };

  addIssueAttachments = async (input: AddIssueAttachmentsInput) => {
    const form = new FormData();
    input.attachments.forEach((item) => {
      form.append("file", Buffer.from(item.content, "base64"), item.filename);
    });
    const { data } = await this.client.post(
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
}
