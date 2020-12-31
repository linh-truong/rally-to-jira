import _ from "lodash";
import TurndownService from "turndown";
import { Logger } from "pino";
import { customAlphabet } from "nanoid";

import { Artifact, RallyService } from "./modules/rally";
import {
  JiraAgileService,
  JiraApiV2Service,
  JiraApiV3Service,
} from "./modules/jira";

interface JiraProjectContext {
  projectId: string;
  defaultBoardId: number;
  issueTypeByName: { [name: string]: string };
  issueFieldByName: { [name: string]: string };
}

interface AppOptions {
  logger: Logger;
  rallyService: RallyService;
  jiraApiV2Service: JiraApiV2Service;
  jiraApiV3Service: JiraApiV3Service;
  jiraAgileService: JiraAgileService;
}

class App implements AppOptions {
  logger: Logger;
  rallyService: RallyService;
  jiraApiV2Service: JiraApiV2Service;
  jiraApiV3Service: JiraApiV3Service;
  jiraAgileService: JiraAgileService;
  jiraProjectContext: JiraProjectContext;
  turndownService = new TurndownService();
  jiraSprintIdByRallyIterationRef: Record<string, number> = {};
  jiraIssueByRallyArtifactRef: Record<
    string,
    {
      id: string;
      key: string;
      self: string;
    }
  > = {};

  constructor(opts: AppOptions) {
    this.jiraAgileService = opts.jiraAgileService;
    this.jiraApiV2Service = opts.jiraApiV2Service;
    this.jiraApiV3Service = opts.jiraApiV3Service;
    this.rallyService = opts.rallyService;
    this.logger = opts.logger;
  }

  migrateRallyProject = async () => {
    const rallyProject = await this.rallyService.getProject();
    const { id: jiraProjectId } = await this.jiraApiV3Service.createProject({
      name: `${rallyProject.Name} ${new Date().toISOString()}`,
      key: "P" + customAlphabet("1234567890", 9)(),
    });

    const jiraProjectIdInString = jiraProjectId.toString();
    const [jiraBoards, jiraIssueTypes, jiraIssueFields] = await Promise.all([
      this.jiraAgileService.getBoards(jiraProjectIdInString),
      this.jiraApiV3Service.getIssueTypesByProjectId(jiraProjectIdInString),
      this.jiraApiV3Service.getIssueFields(),
    ]);
    this.jiraProjectContext = {
      projectId: jiraProjectIdInString,
      defaultBoardId: _.head(jiraBoards.values).id,
      issueTypeByName: _.chain(jiraIssueTypes)
        .keyBy((item) => item.name)
        .mapValues((item) => item.id)
        .value(),
      issueFieldByName: _.chain(jiraIssueFields)
        .keyBy((item) => item.name)
        .mapValues((item) => item.id)
        .value(),
    };
  };

  migrateRallyIteration = async () => {
    const rallyIterations = await this.rallyService.scanIteration();
    for (const rallyIteration of _.orderBy(
      rallyIterations,
      ({ StartDate }) => StartDate
    )) {
      const jiraSprint = await this.jiraAgileService.createSprint({
        name: rallyIteration.Name,
        originBoardId: this.jiraProjectContext.defaultBoardId,
        goal: rallyIteration.Notes,
        startDate: rallyIteration.StartDate,
        endDate: rallyIteration.EndDate,
      });
      this.jiraSprintIdByRallyIterationRef[rallyIteration._ref] = jiraSprint.id;
    }
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
        project: { id: this.jiraProjectContext.projectId },
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
        [this.jiraProjectContext.issueFieldByName["Sprint"]]: this
          .jiraSprintIdByRallyIterationRef[rallyArtifact.Iteration?._ref],
      },
    };
  };

  migrateRallyEpicsToJiraEpics = async (artifacts: Artifact[]) => {
    if (!artifacts || !artifacts.length) {
      return [];
    }
    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Epic"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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
    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Bug"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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

    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Bug"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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
            this.jiraApiV3Service.createIssueLink({
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
        this.jiraApiV3Service.createIssueLink({
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
    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Story"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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
    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Subtask"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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
    const jiraIssueType = this.jiraProjectContext.issueTypeByName["Task"];
    const { errors, issues } = await this.jiraApiV2Service.bulkCreateIssue(
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
            this.jiraApiV3Service.createIssueLink({
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

  migrateArtifactPlanEstimate = async (artifacts: Artifact[]) => {
    return await Promise.all(
      artifacts
        .filter(({ PlanEstimate }) => PlanEstimate)
        .map((artifact) =>
          this.jiraAgileService.estimateIssue({
            boardId: this.jiraProjectContext.defaultBoardId,
            issueIdOrKey: this.jiraIssueByRallyArtifactRef[artifact._ref].id,
            value: artifact.PlanEstimate.toString(),
          })
        )
    );
  };

  migrateRallyArtifactAttachments = async () => {
    const attachments = await this.rallyService.scanAttachment();
    const attachmentsByArtifactRef = _.groupBy(
      attachments,
      (attachment) => attachment.Artifact._ref
    );
    for (const artifactRef in attachmentsByArtifactRef) {
      const issueId = this.jiraIssueByRallyArtifactRef[artifactRef]?.id;
      if (issueId) {
        const artifactAttachments = attachmentsByArtifactRef[artifactRef];
        await this.jiraApiV3Service.addIssueAttachments({
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
    // this.logger.info("Clean up Jira projects");
    // await this.jiraApiV3Service.cleanUpProjects();

    this.logger.info("Migrate Rally project");
    await this.migrateRallyProject();

    this.logger.info("Migrate Rally iterations");
    await this.migrateRallyIteration();

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

    this.logger.info("Migrate Rally artifact plan estimate");
    await this.migrateArtifactPlanEstimate(rallyArtifacts);

    this.logger.info("Migrate Rally artifact attachments");
    await this.migrateRallyArtifactAttachments();

    this.logger.info(
      `Done. ${rallyArtifacts.length} artifact(s) have been migrated`
    );
  };
}

export default App;
