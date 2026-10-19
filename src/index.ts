import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { isAuthorized } from "./auth";
import { groupByDay } from "./daily-log";
import { insertActivity, listActivityRows } from "./db/activities";
import { findClientId, insertClient, listClientShortNames } from "./db/clients";
import { failure, success } from "./tools/results";
import { findTaskIdByExternalId, insertTask, taskExists, updateTask } from "./db/tasks";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function createServer(db: D1Database) {
	const server = new McpServer({ name: "work-log", version: "0.1.0" });

	server.registerTool(
		"create_client",
		{
			description: "Create a client, the person or company that work is done for.",
			inputSchema: {
				name: z.string().min(1).describe("Full name, such as Courthouse Computer Systems"),
				shortName: z.string().min(1).describe("Short unique name, such as CCS"),
				hourlyRate: z.number().nonnegative().describe("Hourly rate in US dollars, such as 18"),
			},
		},
		async ({ name, shortName, hourlyRate }) => {
			const existingId = await findClientId(db, shortName);
			if (existingId !== null) {
				return failure(`A client named ${shortName} already exists as #${existingId}`);
			}
			const id = await insertClient(db, { name, shortName, hourlyRateCents: Math.round(hourlyRate * 100) });
			return success(`Created client #${id} (${shortName})`);
		},
	);

	server.registerTool(
		"create_task",
		{
			description:
				"Create a task, such as a Jira ticket, for a client. Activities are logged under tasks. If a task with the same extId already exists, returns that task instead.",
			inputSchema: {
				description: z.string().min(1).describe("Short title of the task"),
				client: z.string().min(1).describe("Short name of the client the work is for, such as CCS"),
				extId: z.string().min(1).optional().describe("External id, such as the Jira key SPS-204"),
			},
		},
		async ({ description, client, extId }) => {
			const clientId = await findClientId(db, client);
			if (clientId === null) {
				const names = (await listClientShortNames(db)).join(", ");
				return failure(`No client named ${client}. Clients: ${names}`);
			}
			if (extId) {
				const existingId = await findTaskIdByExternalId(db, extId);
				if (existingId !== null) {
					return success(`Task ${extId} already exists as #${existingId}`);
				}
			}
			const id = await insertTask(db, { externalId: extId ?? null, description, clientId });
			return success(`Created task #${id}`);
		},
	);

	server.registerTool(
		"edit_task",
		{
			description: "Change a task's description, client or extId. Only the fields given are changed.",
			inputSchema: {
				taskId: z.number().int().positive().describe("Id of the task to change"),
				description: z.string().min(1).optional().describe("New short title of the task"),
				client: z.string().min(1).optional().describe("Short name of the new client, such as CCS"),
				extId: z.string().min(1).optional().describe("New external id, such as the Jira key SPS-204"),
			},
		},
		async ({ taskId, description, client, extId }) => {
			if (!(await taskExists(db, taskId))) {
				return failure(`Task #${taskId} doesn't exist`);
			}
			let clientId: number | undefined;
			if (client) {
				const foundId = await findClientId(db, client);
				if (foundId === null) {
					const names = (await listClientShortNames(db)).join(", ");
					return failure(`No client named ${client}. Clients: ${names}`);
				}
				clientId = foundId;
			}
			if (extId) {
				const existingId = await findTaskIdByExternalId(db, extId);
				if (existingId !== null && existingId !== taskId) {
					return failure(`Task ${extId} already exists as #${existingId}`);
				}
			}
			await updateTask(db, taskId, { externalId: extId, description, clientId });
			return success(`Updated task #${taskId}`);
		},
	);

	server.registerTool(
		"log_activity",
		{
			description: "Record an activity done as part of a task. Create the task first with create_task if it doesn't exist.",
			inputSchema: {
				description: z.string().min(1).describe("What was done"),
				taskId: z.number().int().positive().describe("Id of the task this activity belongs to"),
				date: dateSchema
					.optional()
					.describe("Day the work was done, as YYYY-MM-DD. Defaults to today in UTC"),
				timeSpent: z.number().int().nonnegative().describe("Time spent, in minutes"),
			},
		},
		async ({ description, taskId, date, timeSpent }) => {
			if (!(await taskExists(db, taskId))) {
				return failure(`Task #${taskId} doesn't exist`);
			}
			const day = date ?? new Date().toISOString().slice(0, 10);
			const id = await insertActivity(db, { description, taskId, date: day, timeSpent });
			return success(`Logged activity #${id} on task #${taskId}`);
		},
	);

	server.registerTool(
		"list_activities",
		{
			description:
				"List logged activities grouped by day, then by task, with time totals. Optionally limit to a date range.",
			inputSchema: {
				from: dateSchema.optional().describe("First day to include, as YYYY-MM-DD"),
				to: dateSchema.optional().describe("Last day to include, as YYYY-MM-DD"),
			},
			outputSchema: {
				days: z.array(
					z.object({
						date: z.string(),
						totalMinutes: z.number(),
						tasks: z.array(
							z.object({
								id: z.number(),
								externalId: z.string().nullable(),
								description: z.string(),
								client: z.string(),
								totalMinutes: z.number(),
								activities: z.array(
									z.object({ id: z.number(), description: z.string(), timeSpent: z.number(), position: z.number() }),
								),
							}),
						),
					}),
				),
			},
			annotations: { readOnlyHint: true },
		},
		async ({ from, to }) => {
			const days = groupByDay(await listActivityRows(db, from ?? null, to ?? null));
			return { structuredContent: { days }, content: [{ type: "text", text: JSON.stringify({ days }) }] };
		},
	);

	return server;
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== "/mcp") {
			return new Response("Not found", { status: 404 });
		}
		if (!(await isAuthorized(request, env.API_KEY))) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Stateless: a fresh server and transport for every request.
		const server = createServer(env.DB);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);
		return transport.handleRequest(request);
	},
} satisfies ExportedHandler<Env>;
