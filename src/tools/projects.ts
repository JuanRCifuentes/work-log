import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findClientId } from "../db/clients";
import { findProjectId, insertProject, updateProject } from "../db/projects";
import { unknownClient, unknownProject } from "./failures";
import { failure, success } from "./results";

export function registerProjectTools(server: McpServer, db: D1Database): void {
	server.registerTool(
		"create_project",
		{
			description: "Create a project for a client, such as ProSearch for CCS. Tasks are created under projects.",
			inputSchema: {
				name: z.string().min(1).describe("Full name, such as Find Genie"),
				shortName: z.string().min(1).describe("Short name, unique across all clients, such as FindGenie"),
				client: z.string().min(1).describe("Short name of the client the project is for, such as CCS"),
			},
		},
		async ({ name, shortName, client }) => {
			const clientId = await findClientId(db, client);
			if (clientId === null) return unknownClient(db, client);
			const existingId = await findProjectId(db, shortName);
			if (existingId !== null) {
				return failure(`A project named ${shortName} already exists as #${existingId}`);
			}
			const id = await insertProject(db, { name, shortName, clientId });
			return success(`Created project #${id} (${shortName})`);
		},
	);

	server.registerTool(
		"edit_project",
		{
			description: "Change a project's name, shortName or client. Only the fields given are changed.",
			inputSchema: {
				project: z.string().min(1).describe("Current short name of the project, such as ProSearch"),
				name: z.string().min(1).optional().describe("New full name"),
				shortName: z.string().min(1).optional().describe("New short name, unique across all clients"),
				client: z.string().min(1).optional().describe("Short name of the new client, such as CCS"),
			},
		},
		async ({ project, name, shortName, client }) => {
			const projectId = await findProjectId(db, project);
			if (projectId === null) return unknownProject(db, project);
			let clientId: number | undefined;
			if (client) {
				const foundId = await findClientId(db, client);
				if (foundId === null) return unknownClient(db, client);
				clientId = foundId;
			}
			if (shortName) {
				const existingId = await findProjectId(db, shortName);
				if (existingId !== null && existingId !== projectId) {
					return failure(`A project named ${shortName} already exists as #${existingId}`);
				}
			}
			await updateProject(db, projectId, { name, shortName, clientId });
			return success(`Updated project #${projectId} (${shortName ?? project})`);
		},
	);
}
