import axios, { AxiosInstance } from "axios";
import _ from "lodash";

import { RallyConfig } from "../container";

interface Project {
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

interface User {
  _ref: string;
  _refObjectUUID: string;
  _refObjectName: string;
}

interface Artifact {
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
    _tagsNameArray: string[];
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
  Children: {
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
  Parent?: any;
  PlanEstimate: number;
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
}

interface Attachment {
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

interface CustomAttachment extends Attachment {
  Base64BiraryContent: string;
}

interface FlowState {
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

class RallyService {
  rallyConfig: RallyConfig;
  client: AxiosInstance;
  maxPageSize = 2000;

  constructor(options: { rallyConfig: RallyConfig }) {
    this.rallyConfig = options.rallyConfig;
    this.client = axios.create({
      baseURL: this.rallyConfig.apiBaseURL,
      headers: {
        ZSESSIONID: this.rallyConfig.apiKey,
      },
    });
  }

  scanResource = async <T = any>({
    resourceName,
    fetch = true,
    pagesize = 50,
  }: {
    resourceName: string;
    fetch?: boolean | string;
    pagesize?: number;
  }) => {
    let records: T[] = [];

    let hasMore = false;
    do {
      const { data } = await this.client.get<{
        QueryResult: {
          Errors: any[];
          Warnings: any[];
          TotalResultCount: number;
          StartIndex: number;
          PageSize: number;
          Results: T[];
        };
      }>(resourceName, {
        params: {
          projectId: `${this.rallyConfig.apiBaseURL}/${this.rallyConfig.projectId}`,
          start: records.length + 1,
          pagesize,
          fetch,
          projectScopeUp: false,
          projectScopeDown: false,
        },
      });
      const { TotalResultCount, Results } = data.QueryResult;
      records = [...records, ...Results];
      hasMore = records.length < TotalResultCount;
    } while (hasMore);

    return records;
  };

  scanArtifact = async () => {
    const records = await this.scanResource<Artifact>({
      resourceName: "artifact",
      fetch: true,
    });
    return records;
  };

  scanAttachment = async () => {
    const pagesize = 20;
    const records = await this.scanResource<Attachment>({
      resourceName: "attachment",
      fetch: true,
      pagesize,
    });

    const base64BiraryContentByObjectID: Record<string, string> = {};
    for (const pageRecords of _.chunk(records, pagesize)) {
      const contentRefLinks = pageRecords.map<string>(
        (record) => record.Content._ref
      );
      const attachmentContents = await Promise.all(
        contentRefLinks.map(this.getAttachmentContent)
      );
      attachmentContents.forEach((content, contentIndex) => {
        base64BiraryContentByObjectID[
          pageRecords[contentIndex].ObjectID
        ] = content;
      });
    }
    const customAttachments = records.map<CustomAttachment>((record) => ({
      ...record,
      Base64BiraryContent: base64BiraryContentByObjectID[record.ObjectID],
    }));
    return customAttachments;
  };

  getAttachmentContent = async (refLink: string) => {
    const { data } = await this.client.get<{
      AttachmentContent: {
        Errors: any[];
        Warnings: any[];
        Content: string;
      };
    }>(refLink, { baseURL: undefined });
    return data.AttachmentContent.Content;
  };

  getProject = async () => {
    const { data } = await this.client.get<{
      Project: Project;
    }>(`project/${this.rallyConfig.projectId}`, {
      params: {
        fetch: true,
        projectScopeUp: false,
        projectScopeDown: false,
      },
    });
    return data.Project;
  };

  scanFlowState = async () => {
    const records = await this.scanResource<FlowState>({
      resourceName: "flowstate",
      pagesize: this.maxPageSize,
    });
    return records;
  };
}

export default RallyService;
