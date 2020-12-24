import axios, { AxiosInstance } from "axios";
import _ from "lodash";

import { RallyConfig } from "../container";

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
}

interface CustomAttachment extends Attachment {
  Base64BiraryContent: string;
}

class RallyService {
  rallyConfig: RallyConfig;
  client: AxiosInstance;

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
    fetch: boolean | string;
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
    const records = await this.scanResource({
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
}

export default RallyService;
