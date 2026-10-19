import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isAuthorized } from "./auth";
import { createServer } from "./server";

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== "/mcp") {
			return new Response("Not found", { status: 404 });
		}
		if (!(await isAuthorized(request, env.API_KEY))) {
			return new Response("Unauthorized", { status: 401 });
		}
		return handleMcpRequest(request, env.DB);
	},
} satisfies ExportedHandler<Env>;

// Stateless: a fresh server and transport for every request.
async function handleMcpRequest(request: Request, db: D1Database): Promise<Response> {
	const server = createServer(db);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);
	return transport.handleRequest(request);
}
