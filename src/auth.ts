// Compares digests so the check takes the same time whatever the key's length.
export async function isAuthorized(request: Request, apiKey: string | undefined): Promise<boolean> {
	if (!apiKey) return false;
	const header = request.headers.get("Authorization") ?? "";
	const encoder = new TextEncoder();
	const [given, expected] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(header)),
		crypto.subtle.digest("SHA-256", encoder.encode(`Bearer ${apiKey}`)),
	]);
	return crypto.subtle.timingSafeEqual(given, expected);
}
