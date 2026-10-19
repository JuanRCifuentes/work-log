import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { listClientShortNames } from "../db/clients";
import { listProjectShortNames } from "../db/projects";
import { failure } from "./results";

// Lists the existing clients so the caller can pick the right one.
export async function unknownClient(db: D1Database, shortName: string): Promise<CallToolResult> {
	const names = (await listClientShortNames(db)).join(", ");
	return failure(`No client named ${shortName}. Clients: ${names}`);
}

// Lists the existing projects so the caller can pick the right one.
export async function unknownProject(db: D1Database, shortName: string): Promise<CallToolResult> {
	const names = (await listProjectShortNames(db)).join(", ");
	return failure(`No project named ${shortName}. Projects: ${names}`);
}

export function duplicateClient(shortName: string, existingId: number): CallToolResult {
	return failure(`A client named ${shortName} already exists as #${existingId}`);
}

export function duplicateProject(shortName: string, existingId: number): CallToolResult {
	return failure(`A project named ${shortName} already exists as #${existingId}`);
}

export function duplicateTask(externalId: string, existingId: number): CallToolResult {
	return failure(`Task ${externalId} already exists as #${existingId}`);
}

export function unknownTask(taskId: number): CallToolResult {
	return failure(`Task #${taskId} doesn't exist`);
}

export function unknownActivity(activityId: number): CallToolResult {
	return failure(`Activity #${activityId} doesn't exist`);
}

export function positionOutOfRange(taskId: number, activityCount: number): CallToolResult {
	return failure(`Task #${taskId} has ${activityCount} activities, so position must be 1 to ${activityCount}`);
}
