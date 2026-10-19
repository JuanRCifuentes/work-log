import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findProjectId } from "../db/projects";
import { findTaskIdByExternalId, insertTask, taskExists, updateTask } from "../db/tasks";
import { duplicateTask, unknownProject, unknownTask } from "./failures";
import { success } from "./results";

export function registerTaskTools(server: McpServer, db: D1Database): void {
	server.registerTool(
		"create_task",
		{
			description:
				"Create a task, such as a Jira ticket, in a project. Activities are logged under tasks. If a task with the same extId already exists, returns that task instead.",
			inputSchema: {
				description: z.string().min(1).describe("Short title of the task"),
				project: z.string().min(1).describe("Short name of the project the work is for, such as ProSearch"),
				extId: z.string().min(1).optional().describe("External id, such as the Jira key SPS-204"),
			},
		},
		async ({ description, project, extId }) => {
			const projectId = await findProjectId(db, project);
			if (projectId === null) return unknownProject(db, project);
			if (extId) {
				const existingId = await findTaskIdByExternalId(db, extId);
				if (existingId !== null) {
					return success(`Task ${extId} already exists as #${existingId}`);
				}
			}
			const id = await insertTask(db, { externalId: extId ?? null, description, projectId });
			return success(`Created task #${id}`);
		},
	);

	server.registerTool(
		"edit_task",
		{
			description: "Change a task's description, project or extId. Only the fields given are changed.",
			inputSchema: {
				taskId: z.number().int().positive().describe("Id of the task to change"),
				description: z.string().min(1).optional().describe("New short title of the task"),
				project: z.string().min(1).optional().describe("Short name of the new project, such as NXT"),
				extId: z.string().min(1).optional().describe("New external id, such as the Jira key SPS-204"),
			},
		},
		async ({ taskId, description, project, extId }) => {
			if (!(await taskExists(db, taskId))) return unknownTask(taskId);
			let projectId: number | undefined;
			if (project) {
				const foundId = await findProjectId(db, project);
				if (foundId === null) return unknownProject(db, project);
				projectId = foundId;
			}
			if (extId) {
				const existingId = await findTaskIdByExternalId(db, extId);
				if (existingId !== null && existingId !== taskId) return duplicateTask(extId, existingId);
			}
			await updateTask(db, taskId, { externalId: extId, description, projectId });
			return success(`Updated task #${taskId}`);
		},
	);
}
