import _ from "lodash";
import { customAlphabet } from "nanoid";

import { Artifact, RallyService } from "./modules/rally";
import { JiraService } from "./modules/jira";

type JiraIssueByRallyArtifactRef = Record<
  string,
  { id: string; key: string; self: string }
>;

interface JiraMigrationConfig {
  projectId: string;
  issueTypeByName: { [name: string]: string };
  issueFieldByName: { [name: string]: string };
}

class App {
  jiraService: JiraService;
  rallyService: RallyService;
  idGenerator = customAlphabet("1234567890", 7);
  jiraIssueByRallyArtifactRef: JiraIssueByRallyArtifactRef = {};

  constructor(opts: { jiraService: JiraService; rallyService: RallyService }) {
    this.jiraService = opts.jiraService;
    this.rallyService = opts.rallyService;
  }

  migrateProject = async () => {
    const rallyProject = await this.rallyService.getProject();
    const result = await this.jiraService.createProject({
      name: `${rallyProject.Name} ${new Date().toISOString()}`,
      key: "P" + this.idGenerator(),
    });
    return result;
  };

  buildJiraMigrationConfig = async (jiraProjectId: string) => {
    const [jiraIssueTypes, jiraIssueFields] = await Promise.all([
      this.jiraService.getIssueTypesByProjectId(jiraProjectId),
      this.jiraService.getIssueFields(),
    ]);
    const jiraMigrationConfig: JiraMigrationConfig = {
      projectId: jiraProjectId,
      issueTypeByName: _.chain(jiraIssueTypes)
        .keyBy((item) => item.name)
        .mapValues((item) => item.id)
        .value(),
      issueFieldByName: _.chain(jiraIssueFields)
        .keyBy((item) => item.name)
        .mapValues((item) => item.id)
        .value(),
    };
    return jiraMigrationConfig;
  };

  migrateJiraEpics = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      input.rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: input.jiraMigrationConfig.issueTypeByName["Epic"] },
          project: { id: input.jiraMigrationConfig.projectId },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ text: artifact.Description, type: "text" }],
              },
            ],
          },
          labels: (artifact.Tags?._tagsNameArray || []).map((tag) =>
            tag.Name.replace(" ", "")
          ),
        },
      }))
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    input.rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateJiraBugs = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      input.rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: input.jiraMigrationConfig.issueTypeByName["Bug"] },
          project: { id: input.jiraMigrationConfig.projectId },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ text: artifact.Description, type: "text" }],
              },
            ],
          },
          labels: (artifact.Tags?._tagsNameArray || []).map((tag) =>
            tag.Name.replace(" ", "")
          ),
        },
      }))
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    input.rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateStories = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      input.rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: input.jiraMigrationConfig.issueTypeByName["Story"] },
          project: { id: input.jiraMigrationConfig.projectId },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ text: artifact.Description, type: "text" }],
              },
            ],
          },
          labels: (artifact.Tags?._tagsNameArray || []).map((tag) =>
            tag.Name.replace(" ", "")
          ),
          parent: this.jiraIssueByRallyArtifactRef[artifact.Parent?._ref]?.key
            ? {
                key: this.jiraIssueByRallyArtifactRef[artifact.Parent?._ref]
                  ?.key,
              }
            : undefined,
        },
      }))
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    input.rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateSubtasks = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      input.rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: {
            id: input.jiraMigrationConfig.issueTypeByName["Subtask"],
          },
          project: { id: input.jiraMigrationConfig.projectId },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ text: artifact.Description, type: "text" }],
              },
            ],
          },
          labels: (artifact.Tags?._tagsNameArray || []).map((tag) =>
            tag.Name.replace(" ", "")
          ),
          parent: this.jiraIssueByRallyArtifactRef[artifact.WorkProduct?._ref]
            ?.key
            ? {
                key: this.jiraIssueByRallyArtifactRef[
                  artifact.WorkProduct?._ref
                ]?.key,
              }
            : undefined,
        },
      }))
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    input.rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  run = async () => {
    await this.jiraService.cleanUpProjects();
    const { id: jiraProjectId } = await this.migrateProject();
    const jiraProjectIdInString = jiraProjectId.toString();
    const jiraMigrationConfig = await this.buildJiraMigrationConfig(
      jiraProjectIdInString
    );

    const rallyArtifacts = await this.rallyService.scanArtifact();
    const classifiedRallyArtifacts = this.rallyService.classifyArtifacts(
      rallyArtifacts
    );

    await this.migrateJiraEpics({
      rallyArtifacts: classifiedRallyArtifacts.epics,
      jiraMigrationConfig,
    });
    await this.migrateJiraBugs({
      rallyArtifacts: [
        ...classifiedRallyArtifacts.defectSuites,
        ...classifiedRallyArtifacts.defects.filter(
          (defect) => !defect.DefectSuites || !defect.DefectSuites.Count
        ),
      ],
      jiraMigrationConfig,
    });
    await this.migrateStories({
      rallyArtifacts: classifiedRallyArtifacts.stories,
      jiraMigrationConfig,
    });
    await this.migrateSubtasks({
      rallyArtifacts: classifiedRallyArtifacts.tasks,
      jiraMigrationConfig,
    });
  };
}

export default App;
