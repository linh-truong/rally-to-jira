import _ from "lodash";
import TurndownService from "turndown";
import { Logger } from "pino";

import { Artifact, RallyService } from "./modules/rally";
import { JiraService } from "./modules/jira";

type JiraIssueByRallyArtifactRef = Record<
  string,
  { id: string; key: string; self: string }
>;

interface JiraProjectConfig {
  projectId: string;
  issueTypeByName: { [name: string]: string };
  issueFieldByName: { [name: string]: string };
}

interface AppOptions {
  logger: Logger;
  idGenerator: () => string;
  turndownService: TurndownService;
  jiraService: JiraService;
  rallyService: RallyService;
}

class App implements AppOptions {
  logger: Logger;
  jiraService: JiraService;
  rallyService: RallyService;
  idGenerator: () => string;
  turndownService: TurndownService;
  jiraIssueByRallyArtifactRef: JiraIssueByRallyArtifactRef = {};
  jiraProjectConfig: JiraProjectConfig;

  constructor(opts: AppOptions) {
    this.logger = opts.logger;
    this.idGenerator = opts.idGenerator;
    this.turndownService = opts.turndownService;
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
    const jiraMigrationConfig: JiraProjectConfig = {
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
    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraProjectConfig.issueTypeByName["Epic"] },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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
    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraProjectConfig.issueTypeByName["Bug"] },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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

    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraProjectConfig.issueTypeByName["Bug"] },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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
              type: { name: "Blocks" },
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
          type: { name: "Blocks" },
        })
      )
    );
  };

  migrateRallyStoriesToJiraStories = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraProjectConfig.issueTypeByName["Story"] },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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
    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: {
            id: this.jiraProjectConfig.issueTypeByName["Subtask"],
          },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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

    const { errors, issues } = await this.jiraService.bulkCreateIssueWithApiV2(
      artifacts.map((artifact) => ({
        fields: {
          summary: artifact.Name,
          issuetype: { id: this.jiraProjectConfig.issueTypeByName["Task"] },
          project: { id: this.jiraProjectConfig.projectId },
          description: this.turndownService.turndown(artifact.Description),
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
              type: { name: "Relates" },
            })
          )
        )
      )
    );
  };

  run = async () => {
    this.logger.info("Clean up Jira projects");
    await this.jiraService.cleanUpProjects();

    this.logger.info("Migrate Rally project");
    const { id: jiraProjectId } = await this.migrateProject();
    const jiraProjectIdInString = jiraProjectId.toString();
    this.jiraProjectConfig = await this.buildJiraMigrationConfig(
      jiraProjectIdInString
    );

    this.logger.info("Scan Rally artifacts");
    const rallyArtifacts = await this.rallyService.scanArtifact();
    const classifiedRallyArtifacts = this.rallyService.classifyArtifacts(
      rallyArtifacts
    );

    this.logger.info("Migrate Rally epics");
    await this.migrateRallyEpicsToJiraEpics(classifiedRallyArtifacts.epics);

    this.logger.info("Migrate Rally defect suites");
    await this.migrateRallyDefectSuitesToJiraBugs(
      classifiedRallyArtifacts.defectSuites
    );

    this.logger.info("Migrate Rally stories");
    await this.migrateRallyStoriesToJiraStories(
      classifiedRallyArtifacts.stories
    );

    this.logger.info("Migrate Rally defects");
    await this.migrateRallyDefectsToJiraBugs(classifiedRallyArtifacts.defects);

    this.logger.info("Migrate Rally tasks");
    await this.migrateRallyTasksToJiraSubtasks(classifiedRallyArtifacts.tasks);

    this.logger.info("Migrate Rally test cases");
    await this.migrateRallyTestCasesToJiraTasks(
      classifiedRallyArtifacts.testCases
    );

    this.logger.info(
      `Done. ${rallyArtifacts.length} artifact(s) have been migrated`
    );
  };
}

export default App;
