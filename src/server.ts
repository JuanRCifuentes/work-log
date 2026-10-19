import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActivityTools } from "./tools/activities";
import { registerClientTools } from "./tools/clients";
import { registerProjectTools } from "./tools/projects";
import { registerTaskTools } from "./tools/tasks";

export function createServer(db: D1Database): McpServer {
	const server = new McpServer({ name: "work-log", version: "0.1.0" });
	registerClientTools(server, db);
	registerProjectTools(server, db);
	registerTaskTools(server, db);
	registerActivityTools(server, db);
	return server;
}
