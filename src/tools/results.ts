import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function success(text: string): CallToolResult {
	return { content: [{ type: "text", text }] };
}

export function failure(text: string): CallToolResult {
	return { isError: true, content: [{ type: "text", text }] };
}
