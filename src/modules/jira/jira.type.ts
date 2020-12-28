export interface JiraConfig {
  apiBaseURL: string;
  username: string;
  apiToken: string;
  leadAccountId: string;
}

export interface WorkflowStatus {
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

export interface ProjectIssueType {
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
}
