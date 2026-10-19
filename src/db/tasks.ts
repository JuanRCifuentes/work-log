import { insertReturningId } from "./statements";

export type NewTask = {
	externalId: string | null;
	description: string;
	clientId: number;
};

export type TaskChanges = Partial<NewTask>;

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
			.prepare("INSERT INTO tasks (external_id, description, client_id) VALUES (?, ?, ?) RETURNING id")
			.bind(task.externalId, task.description, task.clientId),
	);
}

// Fields left undefined keep their current value.
export async function updateTask(db: D1Database, taskId: number, changes: TaskChanges): Promise<void> {
	await db
		.prepare(
			`UPDATE tasks SET
				external_id = COALESCE(?1, external_id),
				description = COALESCE(?2, description),
				client_id = COALESCE(?3, client_id)
			WHERE id = ?4`,
		)
		.bind(changes.externalId ?? null, changes.description ?? null, changes.clientId ?? null, taskId)
		.run();
}
