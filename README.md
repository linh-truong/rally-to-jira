# Rally to Jira

## Pre-requisite

- NodeJS (>= v10) (https://nodejs.org/en/)
- NPM (https://www.npmjs.com/)
- A Rally project
- A Jira domain

## How does the migration tool work?

Basically, this miragtion tool fetches Rally project data with Rally REST API, then migrates Rally project data to Jira project via using Jira REST API.

- Rally REST API: https://rally1.rallydev.com/slm/doc/webservice/
- Jira REST API: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/ & https://developer.atlassian.com/cloud/jira/software/rest/intro/

The migration tool migrates data step-by-step:

- Fetch Rally project
- Create new Jira project
- Scan & migrate all Rally iterations to Jira sprints
- Scan & migrate all Rally artifacts/work items to Jira issues
- Scan & migrate all Rally artifacts attachments to Jira issue attachments

## How to configure the migration tool?

#### Collect all needed information

- Rally API key (https://rally1.rallydev.com/login/accounts/index.html#/keys)
- Rally project ID. For example, with this Rally project URL https://rally1.rallydev.com/#/389693508696d/dashboard , the Rally project ID is `389693508696` (excluded the `d` character at the end)
- Jira domain. For instance: https://rally-to-jira.atlassian.net
- Jira API token (https://id.atlassian.com/manage-profile/security/api-tokens)
- Jira lead account ID. You can firgure your account ID out via checking your Jira profile page, then take the account ID from the page URL. For instance, with this Jira profile page URL https://rally-to-jira.atlassian.net/jira/people/70121:63c1c3fc-d55c-4c92-beb4-a25dc8bfd487, the account ID is `70121:63c1c3fc-d55c-4c92-beb4-a25dc8bfd487`

#### Setup environment variables

- Create new `.env` file in the root folder based on the `.env.example` template
- Fill in all environment variables in the `.env` file

## How to run the migration tool?

Check-out the root folder then run the following commands

```
npm install // Install dependencies
npm run build // Build Typescript
npm start // Run the migration tool
```
