import { insertReturningId } from "./statements";

type NewActivity = {
	description: string;
	taskId: number;
	date: string; // YYYY-MM-DD
	timeSpent: number; // minutes
};

// One activity joined with its task, the task's project and the project's client.
export type ActivityRow = {
	id: number;
	description: string;
	date: string;
	time_spent: number;
	position: number;
	task_id: number;
	external_id: string | null;
	task_description: string;
	project: string | null; // NULL until the task is filed under a project
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
				t.id AS task_id, t.external_id, t.description AS task_description, p.short_name AS project,
				c.short_name AS client
			FROM activities a
			JOIN tasks t ON t.id = a.task_id
			LEFT JOIN projects p ON p.id = t.project_id
			JOIN clients c ON c.id = t.client_id
			WHERE (?1 IS NULL OR a.date >= ?1) AND (?2 IS NULL OR a.date <= ?2)
			ORDER BY a.date, a.id`,
		)
		.bind(from, to)
		.all<ActivityRow>();
	return results;
}

type ActivityChanges = Partial<Omit<NewActivity, "taskId">>;

// Where an activity sits: its task and its place among that task's activities.
type ActivityPlacement = {
	taskId: number;
	position: number;
};

export async function findActivityPlacement(db: D1Database, activityId: number): Promise<ActivityPlacement | null> {
	const row = await db
		.prepare("SELECT task_id, position FROM activities WHERE id = ?")
		.bind(activityId)
		.first<{ task_id: number; position: number }>();
	return row ? { taskId: row.task_id, position: row.position } : null;
}

export async function countTaskActivities(db: D1Database, taskId: number): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS count FROM activities WHERE task_id = ?")
		.bind(taskId)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

// Fields left undefined keep their current value.
export async function updateActivity(db: D1Database, activityId: number, changes: ActivityChanges): Promise<void> {
	await db
		.prepare(
			`UPDATE activities SET
				description = COALESCE(?1, description),
				date = COALESCE(?2, date),
				time_spent = COALESCE(?3, time_spent)
			WHERE id = ?4`,
		)
		.bind(changes.description ?? null, changes.date ?? null, changes.timeSpent ?? null, activityId)
		.run();
}

// Moves the activity to newPosition and shifts the activities in between by one, so positions stay 1..n.
// SQLite checks UNIQUE (task_id, position) row by row, so the shifted rows pass through negative
// positions and the moved row through 0 before landing on their final values.
export async function moveActivity(
	db: D1Database,
	activityId: number,
	from: ActivityPlacement,
	newPosition: number,
): Promise<void> {
	if (newPosition === from.position) return;
	const step = newPosition < from.position ? 1 : -1;
	const low = Math.min(from.position, newPosition);
	const high = Math.max(from.position, newPosition);
	await db.batch([
		db.prepare("UPDATE activities SET position = 0 WHERE id = ?").bind(activityId),
		db
			.prepare("UPDATE activities SET position = -(position + ?1) WHERE task_id = ?2 AND position BETWEEN ?3 AND ?4")
			.bind(step, from.taskId, low, high),
		db.prepare("UPDATE activities SET position = -position WHERE task_id = ? AND position < 0").bind(from.taskId),
		db.prepare("UPDATE activities SET position = ? WHERE id = ?").bind(newPosition, activityId),
	]);
}
