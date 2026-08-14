import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export type SignedHeaders = Record<"x-startime-timestamp" | "x-startime-nonce" | "x-startime-signature", string>;

function requestPayload(method: string, path: string, timestamp: string, nonce: string, body: string): string {
	const bodyHash = createHash("sha256").update(body).digest("hex");
	return [method.toUpperCase(), path, timestamp, nonce, bodyHash].join("\n");
}

export function signInternalRequest(
	secret: string,
	method: string,
	path: string,
	body: string,
	timestamp = new Date().toISOString(),
	nonce = randomUUID(),
): SignedHeaders {
	const signature = createHmac("sha256", secret).update(requestPayload(method, path, timestamp, nonce, body)).digest("hex");
	return {
		"x-startime-timestamp": timestamp,
		"x-startime-nonce": nonce,
		"x-startime-signature": signature,
	};
}

export function verifyInternalRequest(
	secret: string,
	method: string,
	path: string,
	body: string,
	headers: Headers,
): boolean {
	const timestamp = headers.get("x-startime-timestamp");
	const nonce = headers.get("x-startime-nonce");
	const signature = headers.get("x-startime-signature");
	if (!timestamp || !nonce || !signature) return false;

	const requestTime = Date.parse(timestamp);
	if (!Number.isFinite(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) return false;

	const expected = createHmac("sha256", secret)
		.update(requestPayload(method, path, timestamp, nonce, body))
		.digest("hex");
	const received = Buffer.from(signature, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");
	return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}
