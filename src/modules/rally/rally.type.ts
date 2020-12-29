export interface RallyConfig {
  apiBaseURL: string;
  apiKey: string;
  projectId: string;
}

export interface Project {
  _ref: string;
  _refObjectUUID: string;
  _objectVersion: string;
  _refObjectName: string;
  CreationDate: Date;
  _CreatedAt: string;
  ObjectID: number;
  ObjectUUID: string;
  VersionId: string;
  Children: {
    _ref: string;
    _type: string;
    Count: number;
  };
  Description: string;
  Iterations: {
    _ref: string;
    _type: string;
    Count: number;
  };
  Name: string;
  Notes: string;
  Owner: User;
  Releases: {
    _ref: string;
    _type: string;
    Count: number;
  };
  SchemaVersion: string;
  State: string;
  TeamMembers: {
    _ref: string;
    _type: string;
    Count: number;
  };
}

export interface User {
  _ref: string;
  _refObjectUUID: string;
  _refObjectName: string;
}

export interface Artifact {
  _ref: string;
  _refObjectUUID: string;
  _objectVersion: string;
  _refObjectName: string;
  CreationDate: Date;
  ObjectID: number;
  ObjectUUID: string;
  VersionId: string;
  CreatedBy: User;
  Description: string;
  DisplayColor: string;
  Expedite: boolean;
  FormattedID: string;
  LastUpdateDate: Date;
  Name: string;
  Notes: string;
  Owner: User;
  Ready: boolean;
  Tags: {
    _ref: string;
    _tagsNameArray: {
      Name: string;
    }[];
    Count: number;
  };
  FlowState: {
    _ref: string;
    _refObjectUUID: string;
    _refObjectName: string;
  };
  FlowStateChangedDate: Date;
  ScheduleState: string;
  ScheduleStatePrefix: string;
  TestCaseCount: number;
  Attachments: {
    _ref: string;
    Count: number;
  };
  AcceptedDate?: any;
  Blocked: boolean;
  BlockedReason?: any;
  Blocker?: any;
  Children?: {
    _ref: string;
    Count: number;
  };
  DefectStatus?: any;
  Defects: {
    _ref: string;
    Count: number;
  };
  DirectChildrenCount: number;
  DragAndDropRank: string;
  HasParent: boolean;
  InProgressDate?: any;
  Iteration?: any;
  Parent?: {
    _ref: string;
  };
  PlanEstimate?: number;
  Predecessors: {
    _ref: string;
    Count: number;
  };
  Recycled: boolean;
  Release?: any;
  Successors: {
    _ref: string;
    Count: number;
  };
  TaskActualTotal: number;
  TaskEstimateTotal: number;
  TaskRemainingTotal: number;
  TaskStatus?: any;
  Tasks: {
    _ref: string;
    Count: number;
  };
  TestCaseStatus?: any;
  TestCases: {
    _ref: string;
    Count: number;
  };
  WorkProduct?: {
    _ref: string;
  };
  DefectSuites?: {
    _ref: string;
    Count: number;
  };
  Requirement?: {
    _ref: string;
  };
  _type: string;
}

export interface Attachment {
  _ref: string;
  _refObjectUUID: string;
  _objectVersion: string;
  _refObjectName: string;
  CreationDate: Date;
  ObjectID: number;
  ObjectUUID: string;
  Artifact: {
    _ref: string;
    _refObjectUUID: string;
    _refObjectName: string;
  };
  Content: {
    _ref: string;
    _refObjectUUID: string;
  };
  ContentType: string;
  Description?: any;
  Name: string;
  Size: number;
  FlowState: {
    _ref: string;
    _refObjectUUID: string;
    _refObjectName: string;
  };
}

export interface FlowState {
  _ref: string;
  _refObjectUUID: string;
  _objectVersion: string;
  _refObjectName: string;
  CreationDate: Date;
  ObjectID: number;
  ObjectUUID: string;
  VersionId: string;
  AgeThreshold?: any;
  ExitPolicy?: any;
  Name: string;
  OrderIndex: number;
  ScheduleStateMapping: string;
  WIPLimit: number;
}
