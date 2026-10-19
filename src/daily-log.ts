import { z } from "zod";
import type { ActivityRow } from "./db/activities";

// The shape list_activities returns: one entry per day, each with its tasks and their activities.
export const daySchema = z.object({
	date: z.string(), // YYYY-MM-DD
	totalMinutes: z.number(),
	tasks: z.array(
		z.object({
			id: z.number(),
			externalId: z.string().nullable(),
			description: z.string(),
			project: z.string().nullable(),
			client: z.string(),
			totalMinutes: z.number(),
			activities: z.array(
				z.object({
					id: z.number(),
					description: z.string(),
					timeSpent: z.number(), // minutes
					position: z.number(),
				}),
			),
		}),
	),
});

type Day = z.infer<typeof daySchema>;
type DayTask = Day["tasks"][number];

// Groups rows by day, then by task. Rows must be ordered by date, then id, so each day's tasks
// keep the order their first activity was logged in. Each task's activities are sorted by position.
export function groupByDay(rows: ActivityRow[]): Day[] {
	const days: Day[] = [];
	for (const row of rows) {
		const day = currentDay(days, row.date);
		const task = taskInDay(day, row);
		task.activities.push({ id: row.id, description: row.description, timeSpent: row.time_spent, position: row.position });
		task.totalMinutes += row.time_spent;
		day.totalMinutes += row.time_spent;
	}
	for (const day of days) {
		for (const task of day.tasks) task.activities.sort((a, b) => a.position - b.position);
	}
	return days;
}

function currentDay(days: Day[], date: string): Day {
	const last = days.at(-1);
	if (last?.date === date) return last;
	const day: Day = { date, totalMinutes: 0, tasks: [] };
	days.push(day);
	return day;
}

function taskInDay(day: Day, row: ActivityRow): DayTask {
	const existing = day.tasks.find((task) => task.id === row.task_id);
	if (existing) return existing;
	const task: DayTask = {
		id: row.task_id,
		externalId: row.external_id,
		description: row.task_description,
		project: row.project,
		client: row.client,
		totalMinutes: 0,
		activities: [],
	};
	day.tasks.push(task);
	return task;
}
