import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findClientId, insertClient } from "../db/clients";
import { failure, success } from "./results";

export function registerClientTools(server: McpServer, db: D1Database): void {
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
			const id = await insertClient(db, { name, shortName, hourlyRateCents: dollarsToCents(hourlyRate) });
			return success(`Created client #${id} (${shortName})`);
		},
	);
}

function dollarsToCents(dollars: number): number {
	return Math.round(dollars * 100);
}
