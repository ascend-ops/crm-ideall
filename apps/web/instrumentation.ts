export async function register() {
	// Only run server-side checks (not in Edge runtime)
	if (process.env.NEXT_RUNTIME === "nodejs") {
		await checkAuditLogTable();
	}
}

async function checkAuditLogTable() {
	const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
		console.warn(
			"[audit-log] SUPABASE env vars missing — audit logging will be disabled",
		);
		return;
	}

	try {
		const { createClient } = await import("@supabase/supabase-js");
		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
			auth: { persistSession: false },
		});

		// Probe the table with a lightweight select (limit 0 returns no rows but validates the table exists)
		const { error } = await supabase
			.from("audit_log")
			.select("id")
			.limit(1);

		if (error) {
			console.error(
				`[audit-log] TABLE CHECK FAILED: "${error.message}". ` +
					"The audit_log table may not exist. Run the following SQL in Supabase:\n\n" +
					"  CREATE TABLE IF NOT EXISTS audit_log (\n" +
					"    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,\n" +
					"    action TEXT NOT NULL,\n" +
					"    entity_type TEXT,\n" +
					"    entity_id TEXT,\n" +
					"    user_id TEXT,\n" +
					"    tenant_id TEXT,\n" +
					"    ip TEXT,\n" +
					"    user_agent TEXT,\n" +
					"    metadata JSONB,\n" +
					"    created_at TIMESTAMPTZ DEFAULT now()\n" +
					"  );\n" +
					"  CREATE INDEX idx_audit_log_action ON audit_log(action);\n" +
					"  CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);\n" +
					"  CREATE INDEX idx_audit_log_created ON audit_log(created_at);\n",
			);
		} else {
			console.log("[audit-log] Table verified successfully");
		}
	} catch (err) {
		console.error(
			"[audit-log] Failed to verify audit_log table:",
			err instanceof Error ? err.message : err,
		);
	}
}
