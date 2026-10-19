import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

type ActivityRow = {
	id: number;
	description: string;
	date: string;
	time_spent: number;
	position: number;
	task_id: number;
	external_id: string | null;
	task_description: string;
	client: string;
};

type Task = {
	id: number;
	externalId: string | null;
	description: string;
	client: string;
	totalMinutes: number;
	activities: { id: number; description: string; timeSpent: number; position: number }[];
};

// Rows arrive ordered by date then id, so tasks keep the order their first activity was logged in.
// Each task's activities are then sorted by position.
function groupByDay(rows: ActivityRow[]) {
	const days: { date: string; totalMinutes: number; tasks: Task[] }[] = [];
	for (const row of rows) {
		let day = days.at(-1);
		if (day?.date !== row.date) {
			day = { date: row.date, totalMinutes: 0, tasks: [] };
			days.push(day);
		}
		let task = day.tasks.find((t) => t.id === row.task_id);
		if (!task) {
			task = {
				id: row.task_id,
				externalId: row.external_id,
				description: row.task_description,
				client: row.client,
				totalMinutes: 0,
				activities: [],
			};
			day.tasks.push(task);
		}
		task.activities.push({ id: row.id, description: row.description, timeSpent: row.time_spent, position: row.position });
		task.totalMinutes += row.time_spent;
		day.totalMinutes += row.time_spent;
	}
	for (const day of days) for (const task of day.tasks) task.activities.sort((a, b) => a.position - b.position);
	return days;
}

function createServer(env: Env) {
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
			const existing = await env.DB.prepare("SELECT id FROM clients WHERE short_name = ?").bind(shortName).first<{ id: number }>();
			if (existing) {
				return { isError: true, content: [{ type: "text", text: `A client named ${shortName} already exists as #${existing.id}` }] };
			}
			const row = await env.DB.prepare(
				"INSERT INTO clients (name, short_name, hourly_rate_cents) VALUES (?, ?, ?) RETURNING id",
			)
				.bind(name, shortName, Math.round(hourlyRate * 100))
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Created client #${row?.id} (${shortName})` }] };
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
			const clientRow = await env.DB.prepare("SELECT id FROM clients WHERE short_name = ?").bind(client).first<{ id: number }>();
			if (!clientRow) {
				const { results } = await env.DB.prepare("SELECT short_name FROM clients ORDER BY id").all<{ short_name: string }>();
				const names = results.map((r) => r.short_name).join(", ");
				return { isError: true, content: [{ type: "text", text: `No client named ${client}. Clients: ${names}` }] };
			}
			if (extId) {
				const existing = await env.DB.prepare("SELECT id FROM tasks WHERE external_id = ?")
					.bind(extId)
					.first<{ id: number }>();
				if (existing) {
					return { content: [{ type: "text", text: `Task ${extId} already exists as #${existing.id}` }] };
				}
			}
			const row = await env.DB.prepare(
				"INSERT INTO tasks (external_id, description, client_id) VALUES (?, ?, ?) RETURNING id",
			)
				.bind(extId ?? null, description, clientRow.id)
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Created task #${row?.id}` }] };
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
			const task = await env.DB.prepare("SELECT id FROM tasks WHERE id = ?").bind(taskId).first();
			if (!task) {
				return { isError: true, content: [{ type: "text", text: `Task #${taskId} doesn't exist` }] };
			}
			let clientId: number | undefined;
			if (client) {
				const clientRow = await env.DB.prepare("SELECT id FROM clients WHERE short_name = ?").bind(client).first<{ id: number }>();
				if (!clientRow) {
					const { results } = await env.DB.prepare("SELECT short_name FROM clients ORDER BY id").all<{ short_name: string }>();
					const names = results.map((r) => r.short_name).join(", ");
					return { isError: true, content: [{ type: "text", text: `No client named ${client}. Clients: ${names}` }] };
				}
				clientId = clientRow.id;
			}
			if (extId) {
				const existing = await env.DB.prepare("SELECT id FROM tasks WHERE external_id = ? AND id != ?")
					.bind(extId, taskId)
					.first<{ id: number }>();
				if (existing) {
					return { isError: true, content: [{ type: "text", text: `Task ${extId} already exists as #${existing.id}` }] };
				}
			}
			await env.DB.prepare(
				"UPDATE tasks SET description = COALESCE(?1, description), client_id = COALESCE(?2, client_id), external_id = COALESCE(?3, external_id) WHERE id = ?4",
			)
				.bind(description ?? null, clientId ?? null, extId ?? null, taskId)
				.run();
			return { content: [{ type: "text", text: `Updated task #${taskId}` }] };
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
			const task = await env.DB.prepare("SELECT id FROM tasks WHERE id = ?").bind(taskId).first();
			if (!task) {
				return { isError: true, content: [{ type: "text", text: `Task #${taskId} doesn't exist` }] };
			}
			const day = date ?? new Date().toISOString().slice(0, 10);
			// The new activity goes last among the task's activities.
			const row = await env.DB.prepare(
				`INSERT INTO activities (description, task_id, date, time_spent, position)
				SELECT ?1, ?2, ?3, ?4, COALESCE(MAX(position), 0) + 1 FROM activities WHERE task_id = ?2
				RETURNING id`,
			)
				.bind(description, taskId, day, timeSpent)
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Logged activity #${row?.id} on task #${taskId}` }] };
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
			const { results } = await env.DB.prepare(
				`SELECT a.id, a.description, a.date, a.time_spent, a.position, t.id AS task_id, t.external_id, t.description AS task_description, c.short_name AS client
				FROM activities a JOIN tasks t ON t.id = a.task_id JOIN clients c ON c.id = t.client_id
				WHERE (?1 IS NULL OR a.date >= ?1) AND (?2 IS NULL OR a.date <= ?2)
				ORDER BY a.date, a.id`,
			)
				.bind(from ?? null, to ?? null)
				.all<ActivityRow>();
			const days = groupByDay(results);
			return { structuredContent: { days }, content: [{ type: "text", text: JSON.stringify({ days }) }] };
		},
	);

	return server;
}

// Compares digests so the check takes the same time whatever the key's length.
async function isAuthorized(request: Request, apiKey: string | undefined): Promise<boolean> {
	if (!apiKey) return false;
	const header = request.headers.get("Authorization") ?? "";
	const encoder = new TextEncoder();
	const [given, expected] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(header)),
		crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${apiKey}`)),
	]);
	return crypto.subtle.timingSafeEqual(given, expected);
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
		const server = createServer(env);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});
		await server.connect(transport);
		return transport.handleRequest(request);
	},
} satisfies ExportedHandler<Env>;
