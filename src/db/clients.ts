import { insertReturningId } from "./statements";

type NewClient = {
	name: string;
	shortName: string;
	hourlyRateCents: number;
};

export async function findClientId(db: D1Database, shortName: string): Promise<number | null> {
	const row = await db.prepare("SELECT id FROM clients WHERE short_name = ?").bind(shortName).first<{ id: number }>();
	return row?.id ?? null;
}

export async function listClientShortNames(db: D1Database): Promise<string[]> {
	const { results } = await db.prepare("SELECT short_name FROM clients ORDER BY id").all<{ short_name: string }>();
	return results.map((row) => row.short_name);
}

export function insertClient(db: D1Database, client: NewClient): Promise<number> {
	return insertReturningId(
		db
			.prepare("INSERT INTO clients (name, short_name, hourly_rate_cents) VALUES (?, ?, ?) RETURNING id")
			.bind(client.name, client.shortName, client.hourlyRateCents),
	);
}
