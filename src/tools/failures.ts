import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { listClientShortNames } from "../db/clients";
import { failure } from "./results";

// Lists the existing clients so the caller can pick the right one.
export async function unknownClient(db: D1Database, shortName: string): Promise<CallToolResult> {
	const names = (await listClientShortNames(db)).join(", ");
	return failure(`No client named ${shortName}. Clients: ${names}`);
}

export function unknownTask(taskId: number): CallToolResult {
	return failure(`Task #${taskId} doesn't exist`);
}
