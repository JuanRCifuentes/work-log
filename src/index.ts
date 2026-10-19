import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

function createServer(env: Env) {
	const server = new McpServer({ name: "work-log", version: "0.1.0" });

	server.registerTool(
		"create_task",
		{
			description:
				"Create a task, such as a Jira ticket, that activities are logged under. If a task with the same extId already exists, returns that task instead.",
			inputSchema: {
				description: z.string().min(1).describe("Short title of the task"),
				extId: z.string().min(1).optional().describe("External id, such as the Jira key SPS-204"),
			},
		},
		async ({ description, extId }) => {
			if (extId) {
				const existing = await env.DB.prepare("SELECT id FROM tasks WHERE external_id = ?")
					.bind(extId)
					.first<{ id: number }>();
				if (existing) {
					return { content: [{ type: "text", text: `Task ${extId} already exists as #${existing.id}` }] };
				}
			}
			const row = await env.DB.prepare("INSERT INTO tasks (external_id, description) VALUES (?, ?) RETURNING id")
				.bind(extId ?? null, description)
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Created task #${row?.id}` }] };
		},
	);

	server.registerTool(
		"log_activity",
		{
			description: "Record an activity done as part of a task. Create the task first with create_task if it doesn't exist.",
			inputSchema: {
				description: z.string().min(1).describe("What was done"),
				taskId: z.number().int().positive().describe("Id of the task this activity belongs to"),
				date: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
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
			const row = await env.DB.prepare(
				"INSERT INTO activities (description, task_id, date, time_spent) VALUES (?, ?, ?, ?) RETURNING id",
			)
				.bind(description, taskId, day, timeSpent)
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Logged activity #${row?.id} on task #${taskId}` }] };
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
