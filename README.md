# Rally to Jira

## Pre-requisite

- NodeJS (>= v10)
- npm

## How does the migration tool work?

Basically, this miragtion tool fetches Rally project data via Rally REST API, then migrates Rally project data to Jira project via using Jira REST API.

The migration tool migrate data step-by-step:

- Fetch Rally project
- Create new Jira project
- Scan & migrate all Rally iterations to Jira sprints
- Scan & migrate all Rally artifacts/work items to Jira issues
- Scan & migrate all Rally artifacts attachments to Jira issue attachments

## How to run the migration tool?

### Configure

- Create new `.env` file in the root folder based on the `.env.example` template
- Fill in all needed environment variables in the `.env` file

### Build & run

Check-out the root folder then run the following commands

```
npm install ci // Install dependencies
npm run build // Build Typescript
npm start // Run the migration tool
```
