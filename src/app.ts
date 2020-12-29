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

  migrateRallyEpicsToJiraEpics = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { rallyArtifacts, jiraMigrationConfig } = input;
    if (!rallyArtifacts || !rallyArtifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: jiraMigrationConfig.issueTypeByName["Epic"] },
          project: { id: jiraMigrationConfig.projectId },
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
    rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyDefectSuitesToJiraBugs = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { rallyArtifacts, jiraMigrationConfig } = input;
    if (!rallyArtifacts || !rallyArtifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: jiraMigrationConfig.issueTypeByName["Bug"] },
          project: { id: jiraMigrationConfig.projectId },
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
    rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyDefectsToJiraBugs = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { rallyArtifacts, jiraMigrationConfig } = input;
    if (!rallyArtifacts || !rallyArtifacts.length) {
      return [];
    }

    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: jiraMigrationConfig.issueTypeByName["Bug"] },
          project: { id: jiraMigrationConfig.projectId },
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
    rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });

    const rallyDefectsInDefectSuite = rallyArtifacts.filter(
      (defect) => defect.DefectSuites?.Count
    );
    if (rallyDefectsInDefectSuite.length) {
      const defectSuitesList = await Promise.all(
        rallyDefectsInDefectSuite.map((record) =>
          this.rallyService.getDefectSuitesOfDefect(record.DefectSuites?._ref)
        )
      );
      await Promise.all(
        defectSuitesList.map((list, listIndex) =>
          Promise.all(
            list.map((item) =>
              this.jiraService.createIssueLink({
                inwardIssue: {
                  key: this.jiraIssueByRallyArtifactRef[
                    rallyDefectsInDefectSuite[listIndex]._ref
                  ].key,
                },
                outwardIssue: {
                  key: this.jiraIssueByRallyArtifactRef[item._ref].key,
                },
                type: {
                  name: "Blocks",
                },
              })
            )
          )
        )
      );
    }

    return issues;
  };

  migrateRallyStoriesToJiraStories = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { rallyArtifacts, jiraMigrationConfig } = input;
    if (!rallyArtifacts || !rallyArtifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: jiraMigrationConfig.issueTypeByName["Story"] },
          project: { id: jiraMigrationConfig.projectId },
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
    rallyArtifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyTasksToJiraSubtasks = async (input: {
    rallyArtifacts: Artifact[];
    jiraMigrationConfig: JiraMigrationConfig;
  }) => {
    const { rallyArtifacts, jiraMigrationConfig } = input;
    if (!rallyArtifacts || !rallyArtifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      rallyArtifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: {
            id: jiraMigrationConfig.issueTypeByName["Subtask"],
          },
          project: { id: jiraMigrationConfig.projectId },
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
    rallyArtifacts.forEach((item, itemIndex) => {
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

    await this.migrateRallyEpicsToJiraEpics({
      rallyArtifacts: classifiedRallyArtifacts.epics,
      jiraMigrationConfig,
    });
    await this.migrateRallyDefectSuitesToJiraBugs({
      rallyArtifacts: classifiedRallyArtifacts.defectSuites,
      jiraMigrationConfig,
    });
    await this.migrateRallyStoriesToJiraStories({
      rallyArtifacts: classifiedRallyArtifacts.stories,
      jiraMigrationConfig,
    });
    await this.migrateRallyDefectsToJiraBugs({
      rallyArtifacts: classifiedRallyArtifacts.defects,
      jiraMigrationConfig,
    });
    await this.migrateRallyTasksToJiraSubtasks({
      rallyArtifacts: classifiedRallyArtifacts.tasks,
      jiraMigrationConfig,
    });
  };
}

export default App;
