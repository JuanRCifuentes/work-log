import { insertReturningId } from "./statements";

export type NewProject = {
	name: string;
	shortName: string;
	clientId: number;
};

export type ProjectChanges = Partial<NewProject>;

export async function findProjectId(db: D1Database, shortName: string): Promise<number | null> {
	const row = await db.prepare("SELECT id FROM projects WHERE short_name = ?").bind(shortName).first<{ id: number }>();
	return row?.id ?? null;
}

export async function listProjectShortNames(db: D1Database): Promise<string[]> {
	const { results } = await db.prepare("SELECT short_name FROM projects ORDER BY id").all<{ short_name: string }>();
	return results.map((row) => row.short_name);
}

export function insertProject(db: D1Database, project: NewProject): Promise<number> {
	return insertReturningId(
		db
			.prepare("INSERT INTO projects (name, short_name, client_id) VALUES (?, ?, ?) RETURNING id")
			.bind(project.name, project.shortName, project.clientId),
	);
}

// Fields left undefined keep their current value. A new client also moves the project's tasks to it.
export async function updateProject(db: D1Database, projectId: number, changes: ProjectChanges): Promise<void> {
	await db.batch([
		db
			.prepare(
				`UPDATE projects SET
					name = COALESCE(?1, name),
					short_name = COALESCE(?2, short_name),
					client_id = COALESCE(?3, client_id)
				WHERE id = ?4`,
			)
			.bind(changes.name ?? null, changes.shortName ?? null, changes.clientId ?? null, projectId),
		db
			.prepare("UPDATE tasks SET client_id = COALESCE(?1, client_id) WHERE project_id = ?2")
			.bind(changes.clientId ?? null, projectId),
	]);
}
