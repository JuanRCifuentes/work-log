# Work Log

A remote MCP server on Cloudflare Workers that records what you do in a D1 database.

## What it does

The server listens at `/mcp` and exposes one tool:

- `log_activity(description)` adds a row to the `activities` table and returns its id.

## Database

`activities` has two columns, `id` and `description`. The schema lives in `migrations/`, and `npm run deploy` applies any new migrations before deploying.

## Deploying from GitHub

1. In the Cloudflare dashboard, open the `work-log` Worker and go to *Settings → Builds → Connect*, then pick this repository.
2. Set the deploy command to `npm run deploy`.
3. Every push to `main` then builds and deploys the Worker.

## Using it from Claude

Add `https://work-log.<your-subdomain>.workers.dev/mcp` as a custom connector in Claude under *Settings → Connectors*.

The endpoint has no authentication yet, so anyone who knows the URL can write to the log.

## Local development

```sh
npm install
npx wrangler d1 migrations apply work-log --local
npm run dev
```
