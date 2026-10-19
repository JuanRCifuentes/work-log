import { insertReturningId } from "./statements";

export type NewActivity = {
	description: string;
	taskId: number;
	date: string; // YYYY-MM-DD
	timeSpent: number; // minutes
};

// One activity joined with its task and the task's client.
export type ActivityRow = {
	id: number;
	description: string;
	date: string;
	time_spent: number;
	position: number;
	task_id: number;
	external_id: string | null;
	task_description: string;
	client: string;
};

// The new activity goes last among its task's activities.
export function insertActivity(db: D1Database, activity: NewActivity): Promise<number> {
	return insertReturningId(
		db
			.prepare(
				`INSERT INTO activities (description, task_id, date, time_spent, position)
				SELECT ?1, ?2, ?3, ?4, COALESCE(MAX(position), 0) + 1 FROM activities WHERE task_id = ?2
				RETURNING id`,
			)
			.bind(activity.description, activity.taskId, activity.date, activity.timeSpent),
	);
}

// Ordered by date, then by id, so each day's tasks come in the order their first activity was logged.
export async function listActivityRows(db: D1Database, from: string | null, to: string | null): Promise<ActivityRow[]> {
	const { results } = await db
		.prepare(
			`SELECT a.id, a.description, a.date, a.time_spent, a.position,
				t.id AS task_id, t.external_id, t.description AS task_description, c.short_name AS client
			FROM activities a
			JOIN tasks t ON t.id = a.task_id
			JOIN clients c ON c.id = t.client_id
			WHERE (?1 IS NULL OR a.date >= ?1) AND (?2 IS NULL OR a.date <= ?2)
			ORDER BY a.date, a.id`,
		)
		.bind(from, to)
		.all<ActivityRow>();
	return results;
}
