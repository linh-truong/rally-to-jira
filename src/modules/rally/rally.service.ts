import axios, { AxiosInstance } from "axios";
import _ from "lodash";

import {
  Attachment,
  Project,
  FlowState,
  RallyConfig,
  Artifact,
} from "./rally.type";

interface CustomAttachment extends Attachment {
  Base64BiraryContent: string;
}

export class RallyService {
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

  getDefectSuitesOfDefect = async (refLink: string) => {
    const { data } = await this.client.get<{
      QueryResult: {
        Errors: any[];
        Warnings: any[];
        Results: {
          _ref: string;
          ObjectID: string;
          ObjectUUID: string;
        }[];
      };
    }>(refLink, {
      baseURL: undefined,
      params: {
        pagesize: this.maxPageSize,
        projectScopeUp: false,
        projectScopeDown: false,
      },
    });
    return data.QueryResult.Results;
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

  classifyArtifacts = (artifacts: Artifact[]) => {
    const artifactsByType = _.groupBy(artifacts, (artifact) => artifact._type);
    const tasks = artifactsByType["Task"] || [];
    const testCases = artifactsByType["TestCase"] || [];
    const defects = artifactsByType["Defect"] || [];
    const defectSuites = artifactsByType["DefectSuite"] || [];
    const hierarchicalRequirements =
      artifactsByType["HierarchicalRequirement"] || [];
    const epics: Artifact[] = [];
    const stories: Artifact[] = [];
    hierarchicalRequirements.forEach((hr) => {
      if (hr.Children?.Count) {
        epics.push(hr);
      } else {
        stories.push(hr);
      }
    });
    return {
      tasks,
      testCases,
      defects,
      defectSuites,
      stories,
      epics,
    };
  };
}
