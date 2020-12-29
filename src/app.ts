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
    await this.createLinksForDefectAndDefectSuite(rallyDefectsInDefectSuite);

    const rallyDefectsInStory = rallyArtifacts.filter(
      (defect) => defect.Requirement?._ref
    );
    await this.createLinksForDefectAndStory(rallyDefectsInStory);

    return issues;
  };

  createLinksForDefectAndDefectSuite = async (defects: Artifact[]) => {
    if (!defects || !defects.length) {
      return;
    }
    const defectSuitesList = await Promise.all(
      defects.map((defect) =>
        this.rallyService.getDefectSuitesOfDefect(defect.DefectSuites?._ref)
      )
    );
    await Promise.all(
      defectSuitesList.map((list, listIndex) =>
        Promise.all(
          list.map((item) =>
            this.jiraService.createIssueLink({
              inwardIssue: {
                key: this.jiraIssueByRallyArtifactRef[defects[listIndex]._ref]
                  .key,
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
  };

  createLinksForDefectAndStory = async (defects: Artifact[]) => {
    if (!defects || !defects.length) {
      return;
    }
    await Promise.all(
      defects.map((defect) =>
        this.jiraService.createIssueLink({
          inwardIssue: {
            key: this.jiraIssueByRallyArtifactRef[defect._ref].key,
          },
          outwardIssue: {
            key: this.jiraIssueByRallyArtifactRef[defect.Requirement._ref].key,
          },
          type: {
            name: "Blocks",
          },
        })
      )
    );
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

  migrateRallyTestCasesToJiraTasks = async (input: {
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
          issuetype: { id: jiraMigrationConfig.issueTypeByName["Task"] },
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

    const rallyTestCasesInDefect = rallyArtifacts.filter(
      (defect) => defect.Defects?.Count
    );
    await this.createLinksForTestCaseAndDefect(rallyTestCasesInDefect);

    return issues;
  };

  createLinksForTestCaseAndDefect = async (testCases: Artifact[]) => {
    if (!testCases || !testCases.length) {
      return;
    }
    const arrayOfDefectList = await Promise.all(
      testCases.map((defect) =>
        this.rallyService.getDefectsOfTestCase(defect.Defects?._ref)
      )
    );
    await Promise.all(
      arrayOfDefectList.map((list, listIndex) =>
        Promise.all(
          list.map((item) =>
            this.jiraService.createIssueLink({
              inwardIssue: {
                key: this.jiraIssueByRallyArtifactRef[testCases[listIndex]._ref]
                  .key,
              },
              outwardIssue: {
                key: this.jiraIssueByRallyArtifactRef[item._ref].key,
              },
              type: {
                name: "Relates",
              },
            })
          )
        )
      )
    );
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
    await this.migrateRallyTestCasesToJiraTasks({
      rallyArtifacts: classifiedRallyArtifacts.testCases,
      jiraMigrationConfig,
    });
  };
}

export default App;
