import { NextResponse } from "next/server";

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
	const now = Date.now();
	for (const [key, value] of store) {
		if (now > value.resetAt) {
			store.delete(key);
		}
	}
}, 5 * 60 * 1000);

function getClientIp(req: Request): string {
	const forwarded = req.headers.get("x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0].trim();
	}
	return "unknown";
}

export function withRateLimit(
	req: Request,
	config: RateLimitConfig,
): NextResponse | null {
	const ip = getClientIp(req);
	const key = `${ip}:${new URL(req.url).pathname}`;
	const now = Date.now();

	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		store.set(key, { count: 1, resetAt: now + config.windowMs });
		return null;
	}

	entry.count++;

	if (entry.count > config.maxRequests) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return NextResponse.json(
			{ error: "Demasiados pedidos. Tente novamente mais tarde." },
			{
				status: 429,
				headers: { "Retry-After": String(retryAfter) },
			},
		);
	}

	return null;
}
