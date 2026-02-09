import { NextResponse, type NextRequest } from "next/server";

// Rate limit configuration per API path (most specific first — find() returns first match)
const RATE_LIMITS: Array<{
	path: string;
	maxRequests: number;
	windowMs: number;
}> = [
	{ path: "/api/auth/sign-up", maxRequests: 5, windowMs: 300_000 },
	{ path: "/api/auth/sign-in", maxRequests: 10, windowMs: 60_000 },
	{ path: "/api/auth/create-parceiro", maxRequests: 5, windowMs: 300_000 },
	{ path: "/api/consentimento/aceitar", maxRequests: 5, windowMs: 60_000 },
	{
		path: "/api/consentimento/verificar-expirados",
		maxRequests: 3,
		windowMs: 60_000,
	},
	{ path: "/api/consentimento/verificar", maxRequests: 15, windowMs: 60_000 },
	{ path: "/api/consentimento", maxRequests: 10, windowMs: 60_000 },
];

// In-memory store — Edge Runtime instances persist for minutes-to-hours on Vercel,
// significantly longer than serverless route handlers (seconds). Not distributed across
// regions, but effective per-region rate limiting without external services.
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

function getClientIp(request: NextRequest): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0].trim();
	return "unknown";
}

function checkRateLimit(request: NextRequest): NextResponse | null {
	const pathname = request.nextUrl.pathname;
	const rlConfig = RATE_LIMITS.find((rl) => pathname.startsWith(rl.path));
	if (!rlConfig) return null;

	const ip = getClientIp(request);
	const key = `${ip}:${rlConfig.path}`;
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		store.set(key, { count: 1, resetAt: now + rlConfig.windowMs });
		return null;
	}

	entry.count++;

	if (entry.count > rlConfig.maxRequests) {
		const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
		return NextResponse.json(
			{ error: "Demasiados pedidos. Tente novamente mais tarde." },
			{ status: 429, headers: { "Retry-After": String(retryAfter) } },
		);
	}

	return null;
}

export function proxy(request: NextRequest) {
	// Rate limiting checked first (before any other processing)
	const rateLimitResponse = checkRateLimit(request);
	if (rateLimitResponse) return rateLimitResponse;

	// Redirect root to login
	if (request.nextUrl.pathname === "/") {
		return NextResponse.redirect(new URL("/auth/login", request.url));
	}

	// Generate per-request nonce for CSP
	const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
	const isDev = process.env.NODE_ENV === "development";

	const cspDirectives = [
		"default-src 'self'",
		// Production: nonce + strict-dynamic (no unsafe-inline/eval needed)
		// Development: unsafe-eval required for React Fast Refresh / HMR
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
		// Production: nonce-based styles; Development: unsafe-inline for Turbopack style injection
		isDev
			? "style-src 'self' 'unsafe-inline'"
			: `style-src 'self' 'nonce-${nonce}'`,
		"img-src 'self' data: blob: https://*.supabase.co",
		"font-src 'self' data:",
		"connect-src 'self' https://*.supabase.co wss://*.supabase.co",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	];

	const cspHeaderValue = cspDirectives.join("; ");

	// Pass nonce to server components via request header
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set("x-nonce", nonce);
	requestHeaders.set("Content-Security-Policy", cspHeaderValue);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});

	// Security headers
	response.headers.set("X-Frame-Options", "DENY");
	response.headers.set("X-Content-Type-Options", "nosniff");
	response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	response.headers.set(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains",
	);
	response.headers.set("Content-Security-Policy", cspHeaderValue);
	response.headers.set(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
	);

	return response;
}

export const config = {
	matcher: [
		{
			source: "/((?!_next/static|_next/image|favicon.ico).*)",
			missing: [
				{ type: "header", key: "next-router-prefetch" },
				{ type: "header", key: "purpose", value: "prefetch" },
			],
		},
	],
};
