import axios, { AxiosInstance } from "axios";

import { JiraConfig } from "../container";

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

interface WorkflowStatus {
  self: string;
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: {
    self: string;
    id: number;
    key: string;
    colorName: string;
    name: string;
  };
  scope: {
    type: string;
    project: {
      id: string;
    };
  };
}

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
    description: {
      type: string;
      version: number;
      content: {
        type: string;
        content: {
          text: string;
          type: string;
        }[];
      }[];
    };
    labels: string[];
  };
}

type BulkCreateIssueInput = CreateIssueInput[];

interface BulkCreateIssueOutput {
  issues: {
    id: string;
    key: string;
    self: string;
    transition: {
      status: number;
      errorCollection: {
        errorMessages: any[];
        errors: any;
      };
    };
  }[];
  errors: any[];
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

  getAllWorkflowStatuses = async () => {
    const { data } = await this.client.get<WorkflowStatus[]>("status");
    return data;
  };

  getWorkflowStatusesByProjectId = async (projectId: number) => {
    const { data } = await this.client.get<WorkflowStatus[]>("status");
    const projectIdInString = projectId.toString();
    return data.filter((item) => item.scope.project.id === projectIdInString);
  };

  getIssueTypesByProjectId = async (projectId: number) => {
    const { data } = await this.client.get<{
      projects: {
        self: string;
        id: string;
        key: string;
        name: string;
        issuetypes: {
          self: string;
          id: string;
          description: string;
          iconUrl: string;
          name: string;
          subtask: boolean;
          fields: {
            issuetype: {
              required: boolean;
              name: string;
              key: string;
              hasDefaultValue: boolean;
              operations: string[];
            };
          };
        }[];
      }[];
    }>("issue/createmeta");
    const projectIdInString = projectId.toString();
    const targetProject = data.projects.find(
      (item) => item.id === projectIdInString
    );
    return targetProject?.issuetypes || [];
  };

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

export default JiraService;
