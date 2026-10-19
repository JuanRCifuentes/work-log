import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function success(text: string): CallToolResult {
	return { content: [{ type: "text", text }] };
}

// Returns data both as structured content and as its JSON text, for clients that read only text.
export function structuredSuccess(data: Record<string, unknown>): CallToolResult {
	return { structuredContent: data, content: [{ type: "text", text: JSON.stringify(data) }] };
}

export function failure(text: string): CallToolResult {
	return { isError: true, content: [{ type: "text", text }] };
}
