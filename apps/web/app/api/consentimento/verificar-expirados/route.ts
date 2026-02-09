import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { logAudit } from "../../../../lib/audit-log";

function getServiceSupabase() {
	const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
		throw new Error("Missing SUPABASE env vars");
	}

	return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
		auth: { persistSession: false },
	});
}

export async function GET() {
	try {
		// Verificar CRON_SECRET
		const headersList = await headers();
		const authHeader = headersList.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
		}

		const serviceSupabase = getServiceSupabase();
		const agora = new Date().toISOString();

		// Buscar consentimentos pendentes expirados
		const { data: expirados, error: fetchError } = await serviceSupabase
			.from("consentimentos")
			.select("id")
			.eq("status", "pendente")
			.lt("expiraEm", agora);

		if (fetchError) {
			return NextResponse.json({ error: fetchError.message }, { status: 500 });
		}

		if (!expirados || expirados.length === 0) {
			return NextResponse.json({ actualizados: 0 });
		}

		const ids = expirados.map((c) => c.id);

		// Actualizar status para expirado
		const { error: updateError } = await serviceSupabase
			.from("consentimentos")
			.update({ status: "expirado", updatedAt: agora })
			.in("id", ids);

		if (updateError) {
			return NextResponse.json({ error: updateError.message }, { status: 500 });
		}

		logAudit("consent.expired_batch", "consentimento", null, null, null, null, {
			count: ids.length,
		});

		return NextResponse.json({ actualizados: ids.length });
	} catch (err: any) {
		return NextResponse.json({ error: "Erro interno" }, { status: 500 });
	}
}
