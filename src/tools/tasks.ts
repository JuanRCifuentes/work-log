import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findClientId } from "../db/clients";
import { findTaskIdByExternalId, insertTask, taskExists, updateTask } from "../db/tasks";
import { unknownClient, unknownTask } from "./failures";
import { failure, success } from "./results";

export function registerTaskTools(server: McpServer, db: D1Database): void {
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
			if (clientId === null) return unknownClient(db, client);
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
			if (!(await taskExists(db, taskId))) return unknownTask(taskId);
			let clientId: number | undefined;
			if (client) {
				const foundId = await findClientId(db, client);
				if (foundId === null) return unknownClient(db, client);
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
}
