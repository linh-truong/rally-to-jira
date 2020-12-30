import _ from "lodash";
import TurndownService from "turndown";
import { Logger } from "pino";
import { customAlphabet } from "nanoid";

import { Artifact, RallyService } from "./modules/rally";
import { JiraService } from "./modules/jira";

interface JiraProjectConfig {
  projectId: string;
  issueTypeByName: { [name: string]: string };
  issueFieldByName: { [name: string]: string };
}

interface AppOptions {
  logger: Logger;
  jiraService: JiraService;
  rallyService: RallyService;
}

class App implements AppOptions {
  logger: Logger;
  rallyService: RallyService;
  jiraService: JiraService;
  jiraProjectConfig: JiraProjectConfig;
  turndownService = new TurndownService();
  jiraIssueByRallyArtifactRef: Record<
    string,
    {
      id: string;
      key: string;
      self: string;
    }
  > = {};

  constructor(opts: AppOptions) {
    this.jiraService = opts.jiraService;
    this.rallyService = opts.rallyService;
    this.logger = opts.logger;
  }

  migrateRallyProject = async () => {
    const rallyProject = await this.rallyService.getProject();
    const result = await this.jiraService.createProject({
      name: `${rallyProject.Name} ${new Date().toISOString()}`,
      key: "P" + customAlphabet("1234567890", 7)(),
    });
    return result;
  };

  getJiraProjectConfig = async (jiraProjectId: string) => {
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

  migrateRallyIteration = async () => {
    const jiraBoards = await this.jiraService.getBoards(
      this.jiraProjectConfig.projectId
    );
    const defaultBoard = jiraBoards.values[0];
    if (!defaultBoard) {
      return [];
    }

    const rallyIterations = await this.rallyService.scanIteration();
    const jiraSprints = await Promise.all(
      rallyIterations.map((iteration) =>
        this.jiraService.createSprint({
          name: iteration.Name,
          originBoardId: defaultBoard.id,
          goal: iteration.Notes,
          startDate: iteration.StartDate,
          endDate: iteration.EndDate,
        })
      )
    );
    return jiraSprints;
  };

  buildCreateJiraIssueInput = (data: {
    rallyArtifact: Artifact;
    rallyArtifactParentRef?: string;
    jiraIssueType: string;
  }) => {
    const { rallyArtifact, rallyArtifactParentRef, jiraIssueType } = data;
    return {
      fields: {
        summary: rallyArtifact.Name,
        issuetype: { id: jiraIssueType },
        project: { id: this.jiraProjectConfig.projectId },
        description: this.turndownService.turndown(rallyArtifact.Description),
        labels: (rallyArtifact.Tags?._tagsNameArray || []).map((tag) =>
          tag.Name.replace(" ", "")
        ),
        parent:
          rallyArtifactParentRef &&
          this.jiraIssueByRallyArtifactRef[rallyArtifactParentRef]?.key
            ? {
                key: this.jiraIssueByRallyArtifactRef[rallyArtifactParentRef]
                  ?.key,
              }
            : undefined,
      },
    };
  };

  migrateRallyEpicsToJiraEpics = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Epic"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          jiraIssueType,
        })
      )
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
    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Bug"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          jiraIssueType,
        })
      )
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

    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Bug"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          jiraIssueType,
        })
      )
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });

    await Promise.all([
      this.createLinksForRallyDefectAndDefectSuite(
        artifacts.filter((defect) => defect.DefectSuites?.Count)
      ),
      this.createLinksForRallyDefectAndStory(
        artifacts.filter((defect) => defect.Requirement?._ref)
      ),
    ]);
    return issues;
  };

  createLinksForRallyDefectAndDefectSuite = async (artifacts: Artifact[]) => {
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

  createLinksForRallyDefectAndStory = async (artifacts: Artifact[]) => {
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
    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Story"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          rallyArtifactParentRef: artifact.Parent?._ref,
          jiraIssueType,
        })
      )
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
    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Subtask"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          rallyArtifactParentRef: artifact.WorkProduct?._ref,
          jiraIssueType,
        })
      )
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
    const jiraIssueType = this.jiraProjectConfig.issueTypeByName["Task"];
    const { errors, issues } = await this.jiraService.bulkCreateIssue(
      artifacts.map((artifact) =>
        this.buildCreateJiraIssueInput({
          rallyArtifact: artifact,
          jiraIssueType,
        })
      )
    );
    if (errors && errors.length) {
      throw new Error(JSON.stringify(errors));
    }
    artifacts.forEach((item, itemIndex) => {
      this.jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    await this.createLinksForRallyTestCaseAndDefect(
      artifacts.filter((defect) => defect.Defects?.Count)
    );
    return issues;
  };

  createLinksForRallyTestCaseAndDefect = async (artifacts: Artifact[]) => {
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

  migrateRallyArtifactAttacments = async () => {
    const attachments = await this.rallyService.scanAttachment();
    const attachmentsByArtifactRef = _.groupBy(
      attachments,
      (attachment) => attachment.Artifact._ref
    );
    for (const artifactRef in attachmentsByArtifactRef) {
      const issueId = this.jiraIssueByRallyArtifactRef[artifactRef]?.id;
      if (issueId) {
        const artifactAttachments = attachmentsByArtifactRef[artifactRef];
        await this.jiraService.addIssueAttachments({
          issueIdOrKey: issueId,
          attachments: artifactAttachments.map(
            ({ Base64BiraryContent, Name }) => ({
              filename: Name,
              content: Base64BiraryContent,
            })
          ),
        });
      }
    }
    return attachments;
  };

  run = async () => {
    this.logger.info("Clean up Jira projects");
    await this.jiraService.cleanUpProjects();

    this.logger.info("Migrate Rally project");
    const { id: jiraProjectId } = await this.migrateRallyProject();
    const jiraProjectIdInString = jiraProjectId.toString();
    this.jiraProjectConfig = await this.getJiraProjectConfig(
      jiraProjectIdInString
    );

    this.logger.info("Migrate Rally iterations");
    const jiraSprints = await this.migrateRallyIteration();

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

    this.logger.info("Migrate Rally artifact attachments");
    await this.migrateRallyArtifactAttacments();

    this.logger.info(
      `Done. ${rallyArtifacts.length} artifact(s) have been migrated`
    );
  };
}

export default App;
