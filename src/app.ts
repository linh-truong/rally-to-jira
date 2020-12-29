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
  jiraMigrationConfig: JiraMigrationConfig;

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

  migrateRallyEpicsToJiraEpics = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraMigrationConfig.issueTypeByName["Epic"] },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyDefectSuitesToJiraBugs = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraMigrationConfig.issueTypeByName["Bug"] },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyDefectsToJiraBugs = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }

    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraMigrationConfig.issueTypeByName["Bug"] },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });

    const rallyDefectsInDefectSuite = artifacts.filter(
      (defect) => defect.DefectSuites?.Count
    );
    await this.createLinksForDefectAndDefectSuite(rallyDefectsInDefectSuite);

    const rallyDefectsInStory = artifacts.filter(
      (defect) => defect.Requirement?._ref
    );
    await this.createLinksForDefectAndStory(rallyDefectsInStory);

    return issues;
  };

  createLinksForDefectAndDefectSuite = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return;
    }
    const defectSuitesList = await Promise.all(
      artifacts.map((artifact) =>
        this.rallyService.getDefectSuitesOfDefect(artifact.DefectSuites?._ref)
      )
    );
    await Promise.all(
      defectSuitesList.map((list, listIndex) =>
        Promise.all(
          list.map((item) =>
            this.jiraService.createIssueLink({
              inwardIssue: {
                key: this.jiraIssueByRallyArtifactRef[artifacts[listIndex]._ref]
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

  createLinksForDefectAndStory = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return;
    }
    await Promise.all(
      artifacts.map((artifact) =>
        this.jiraService.createIssueLink({
          inwardIssue: {
            key: this.jiraIssueByRallyArtifactRef[artifact._ref].key,
          },
          outwardIssue: {
            key: this.jiraIssueByRallyArtifactRef[artifact.Requirement._ref]
              .key,
          },
          type: {
            name: "Blocks",
          },
        })
      )
    );
  };

  migrateRallyStoriesToJiraStories = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraMigrationConfig.issueTypeByName["Story"] },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyTasksToJiraSubtasks = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: {
            id: this.jiraMigrationConfig.issueTypeByName["Subtask"],
          },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return issues;
  };

  migrateRallyTestCasesToJiraTasks = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }

    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraMigrationConfig.issueTypeByName["Task"] },
          project: { id: this.jiraMigrationConfig.projectId },
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
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });

    const rallyTestCasesInDefect = artifacts.filter(
      (defect) => defect.Defects?.Count
    );
    await this.createLinksForTestCaseAndDefect(rallyTestCasesInDefect);

    return issues;
  };

  createLinksForTestCaseAndDefect = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return;
    }
    const arrayOfDefectList = await Promise.all(
      artifacts.map((artifact) =>
        this.rallyService.getDefectsOfTestCase(artifact.Defects?._ref)
      )
    );
    await Promise.all(
      arrayOfDefectList.map((list, listIndex) =>
        Promise.all(
          list.map((item) =>
            this.jiraService.createIssueLink({
              inwardIssue: {
                key: this.jiraIssueByRallyArtifactRef[artifacts[listIndex]._ref]
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
    this.jiraMigrationConfig = await this.buildJiraMigrationConfig(
      jiraProjectIdInString
    );

    const rallyArtifacts = await this.rallyService.scanArtifact();
    const classifiedRallyArtifacts = this.rallyService.classifyArtifacts(
      rallyArtifacts
    );

    await this.migrateRallyEpicsToJiraEpics(classifiedRallyArtifacts.epics);
    await this.migrateRallyDefectSuitesToJiraBugs(
      classifiedRallyArtifacts.defectSuites
    );
    await this.migrateRallyStoriesToJiraStories(
      classifiedRallyArtifacts.stories
    );
    await this.migrateRallyDefectsToJiraBugs(classifiedRallyArtifacts.defects);
    await this.migrateRallyTasksToJiraSubtasks(classifiedRallyArtifacts.tasks);
    await this.migrateRallyTestCasesToJiraTasks(
      classifiedRallyArtifacts.testCases
    );
  };
}

export default App;
