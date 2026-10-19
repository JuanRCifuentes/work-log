import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

function createServer(env: Env) {
	const server = new McpServer({ name: "work-log", version: "0.1.0" });

	server.registerTool(
		"log_activity",
		{
			description: "Record an activity in the work log.",
			inputSchema: { description: z.string().min(1).describe("What was done") },
		},
		async ({ description }) => {
			const row = await env.DB.prepare("INSERT INTO activities (description) VALUES (?) RETURNING id")
				.bind(description)
				.first<{ id: number }>();
			return { content: [{ type: "text", text: `Logged activity #${row?.id}` }] };
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
