# Work Log

A remote MCP server on Cloudflare Workers that records what you do in a D1 database.

## What it does

The server listens at `/mcp` and exposes these tools:

- `create_client(name, shortName, hourlyRate)` adds a client. `hourlyRate` is in US dollars and is stored in cents.
- `create_task(description, client, extId?)` adds a row to the `tasks` table for the client with that short name and returns its id. If a task with that `extId` already exists, it returns the existing one.
- `edit_task(taskId, description?, client?, extId?)` changes the given fields of a task, such as moving it to another client by short name.
- `log_activity(description, taskId, date?, timeSpent)` adds a row to the `activities` table under that task and returns its id. `date` is `YYYY-MM-DD` and defaults to today in UTC; `timeSpent` is in minutes.
- `list_activities(from?, to?)` returns activities grouped by day and then by task, with each task's client short name and each day's and task's total minutes. `from` and `to` are optional `YYYY-MM-DD` bounds.

## Database

- `clients`: `id`, `name`, `short_name` (unique, such as `CCS`) and `hourly_rate_cents` (the hourly rate in US cents).
- `tasks`: `id`, `external_id` (an external id such as the Jira key `SPS-204`, optional and unique), `description` and `client_id` (a foreign key to `clients`).
- `activities`: `id`, `description`, `date` (`YYYY-MM-DD`), `task_id` (a foreign key to `tasks`) and `time_spent` (in minutes).

Every task belongs to one client. A task holds many activities, and each activity belongs to one task. In the activity log doc, tasks are the numbered items and activities are the lettered lines under them:

```
1. SPS-237: Reset Land Records column order (20 min)   <- task
   a. Saved the user's column order to their preferences   <- activity
   b. Made Reset Column Order restore the defaults          <- activity
```

A task's time is the sum of its activities' `time_spent`, and a day's total is the sum over that day's activities.

The schema lives in `migrations/`, and `npm run deploy` applies any new migrations before deploying.

## Deploying from GitHub

1. In the Cloudflare dashboard, open the `work-log` Worker and go to *Settings → Builds → Connect*, then pick this repository.
2. Leave the build command empty and set the deploy command to `npm run deploy`.
3. Turn off preview builds for now: there is only one database, so previews would write to it.
4. Every push to `main` then builds and deploys the Worker.

If the migration step fails with an authentication error, add *D1 Edit* to the build's API token.

## Using it from Claude

Add `https://work-log.<your-subdomain>.workers.dev/mcp` as a custom connector in Claude under *Settings → Connectors*, with the request header `Authorization: Bearer <your API key>`.

## API key

Every request to `/mcp` must send `Authorization: Bearer <API_KEY>`. Set the key as a secret on the Worker under *Settings → Variables and Secrets* (type *Secret*, name `API_KEY`). Until it is set, the server rejects every request.

## Local development

```sh
npm install
echo 'API_KEY=local-dev-key' > .dev.vars
npx wrangler d1 migrations apply work-log --local
npm run dev
```
