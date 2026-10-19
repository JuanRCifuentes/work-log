// Runs an INSERT ... RETURNING id and gives back the new row's id.
export async function insertReturningId(statement: D1PreparedStatement): Promise<number> {
	const row = await statement.first<{ id: number }>();
	if (!row) throw new Error("INSERT returned no row");
	return row.id;
}
