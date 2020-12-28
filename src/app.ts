import _ from "lodash";
import { customAlphabet } from "nanoid";

import { Artifact, RallyService } from "./modules/rally";
import { JiraService } from "./modules/jira";

class App {
  jiraService: JiraService;
  rallyService: RallyService;
  idGenerator = customAlphabet("1234567890", 7);

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

  migrateEpic = async (input: {
    rallyArtifacts: Artifact[];
    jiraEpicTypeId: string;
    jiraProjectId: string | number;
  }) => {
    const { issues } = await this.jiraService.bulkCreateIssue(
      input.rallyArtifacts.map((epic) => ({
        fields: {
          summary: epic.Name,
          issuetype: { id: input.jiraEpicTypeId },
          project: { id: input.jiraProjectId.toString() },
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ text: epic.Description, type: "text" }],
              },
            ],
          },
          labels: (epic.Tags?._tagsNameArray || []).map((tag) =>
            tag.Name.replace(" ", "")
          ),
        },
      }))
    );
    const jiraIssueByRallyArtifactRef: Record<
      string,
      { id: string; key: string; self: string }
    > = {};
    input.rallyArtifacts.forEach((item, itemIndex) => {
      jiraIssueByRallyArtifactRef[item._ref] = issues[itemIndex];
    });
    return jiraIssueByRallyArtifactRef;
  };

  run = async () => {
    await this.jiraService.cleanUpProjects();
    const { id: jiraProjectId } = await this.migrateProject();
    const [rallyArtifacts, issueTypes] = await Promise.all([
      this.rallyService.scanArtifact(),
      this.jiraService.getIssueTypesByProjectId(jiraProjectId),
    ]);
    const classifiedRallyArtifacts = this.rallyService.classifyArtifacts(
      rallyArtifacts
    );
    const jiraIssueTypeByName = _.keyBy(issueTypes, (item) => item.name);

    const result = await this.migrateEpic({
      rallyArtifacts: [
        ...classifiedRallyArtifacts.epics,
        ...classifiedRallyArtifacts.defectSuites,
      ],
      jiraEpicTypeId: jiraIssueTypeByName["Epic"].id,
      jiraProjectId,
    });
    return result;
  };
}

export default App;
