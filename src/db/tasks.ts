import { insertReturningId } from "./statements";

type NewTask = {
	externalId: string | null;
	description: string;
	projectId: number;
};

type TaskChanges = Partial<NewTask>;

export async function taskExists(db: D1Database, taskId: number): Promise<boolean> {
	const row = await db.prepare("SELECT id FROM tasks WHERE id = ?").bind(taskId).first();
	return row !== null;
}

export async function findTaskIdByExternalId(db: D1Database, externalId: string): Promise<number | null> {
	const row = await db.prepare("SELECT id FROM tasks WHERE external_id = ?").bind(externalId).first<{ id: number }>();
	return row?.id ?? null;
}

export function insertTask(db: D1Database, task: NewTask): Promise<number> {
	return insertReturningId(
		db
			.prepare(
				`INSERT INTO tasks (external_id, description, project_id, client_id)
				VALUES (?1, ?2, ?3, (SELECT client_id FROM projects WHERE id = ?3))
				RETURNING id`,
			)
			.bind(task.externalId, task.description, task.projectId),
	);
}

// Fields left undefined keep their current value. A new project also moves the task to that project's client.
export async function updateTask(db: D1Database, taskId: number, changes: TaskChanges): Promise<void> {
	await db
		.prepare(
			`UPDATE tasks SET
				external_id = COALESCE(?1, external_id),
				description = COALESCE(?2, description),
				project_id = COALESCE(?3, project_id),
				client_id = COALESCE((SELECT client_id FROM projects WHERE id = ?3), client_id)
			WHERE id = ?4`,
		)
		.bind(changes.externalId ?? null, changes.description ?? null, changes.projectId ?? null, taskId)
		.run();
}
