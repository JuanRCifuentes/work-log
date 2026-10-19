# Work Log

A remote MCP server on Cloudflare Workers that records what you do in a D1 database.

## What it does

The server listens at `/mcp` and exposes one tool:

- `log_activity(description)` adds a row to the `activities` table and returns its id.

## Database

- `tasks`: `id`, `external_id` (an external id such as the Jira key `SPS-204`, optional and unique) and `description`.
- `activities`: `id`, `description`, `date` (`YYYY-MM-DD`), `task_id` (a foreign key to `tasks`) and `time_spent` (in minutes).

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
