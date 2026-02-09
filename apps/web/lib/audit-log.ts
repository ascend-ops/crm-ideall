import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
	const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
		return null;
	}

	return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
		auth: { persistSession: false },
	});
}

export function logAudit(
	action: string,
	entityType: string,
	entityId: string | null,
	userId: string | null,
	tenantId: string | null,
	req: Request | null,
	metadata?: Record<string, unknown>,
) {
	const supabase = getServiceSupabase();
	if (!supabase) return;

	const ip = req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
	const userAgent = req?.headers.get("user-agent") || null;

	// Fire-and-forget — never block the request
	supabase
		.from("audit_log")
		.insert({
			action,
			entity_type: entityType,
			entity_id: entityId,
			user_id: userId,
			tenant_id: tenantId,
			ip,
			user_agent: userAgent,
			metadata: metadata || null,
		})
		.then(({ error }) => {
			if (error) {
				console.error("[audit-log] insert failed:", error.message);
			}
		});
}
