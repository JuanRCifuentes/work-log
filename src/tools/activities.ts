import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { groupByDay } from "../daily-log";
import { insertActivity, listActivityRows } from "../db/activities";
import { taskExists } from "../db/tasks";
import { unknownTask } from "./failures";
import { success } from "./results";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Mirrors the Day type in daily-log.ts.
const daySchema = z.object({
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
});

export function registerActivityTools(server: McpServer, db: D1Database): void {
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
			if (!(await taskExists(db, taskId))) return unknownTask(taskId);
			const id = await insertActivity(db, { description, taskId, date: date ?? todayUtc(), timeSpent });
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
			outputSchema: { days: z.array(daySchema) },
			annotations: { readOnlyHint: true },
		},
		async ({ from, to }) => {
			const days = groupByDay(await listActivityRows(db, from ?? null, to ?? null));
			return { structuredContent: { days }, content: [{ type: "text", text: JSON.stringify({ days }) }] };
		},
	);
}

function todayUtc(): string {
	return new Date().toISOString().slice(0, 10);
}
