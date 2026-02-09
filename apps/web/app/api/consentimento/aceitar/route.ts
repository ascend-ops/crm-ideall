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

export async function POST(req: Request) {
	try {
		const { token } = await req.json();
		if (!token) {
			return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
		}

		const serviceSupabase = getServiceSupabase();

		// Buscar consentimento pelo token
		const { data: consentimento, error: fetchError } = await serviceSupabase
			.from("consentimentos")
			.select("id, clienteId, status, expiraEm")
			.eq("token", token)
			.single();

		if (fetchError || !consentimento) {
			return NextResponse.json({ error: "Token inválido" }, { status: 404 });
		}

		if (consentimento.status !== "pendente") {
			return NextResponse.json({ error: "Consentimento já processado" }, { status: 400 });
		}

		if (new Date(consentimento.expiraEm) < new Date()) {
			return NextResponse.json({ error: "Token expirado" }, { status: 400 });
		}

		// Capturar IP e user-agent
		const headersList = await headers();
		const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
		const userAgent = headersList.get("user-agent") || null;

		const agora = new Date().toISOString();

		// Actualizar consentimento e invalidar token
		const { error: updateError } = await serviceSupabase
			.from("consentimentos")
			.update({
				status: "aceite",
				token: null,
				aceitoEm: agora,
				ip,
				userAgent,
				updatedAt: agora,
			})
			.eq("id", consentimento.id);

		if (updateError) {
			return NextResponse.json({ error: updateError.message }, { status: 500 });
		}

		// Actualizar cliente
		const { error: clienteError } = await serviceSupabase
			.from("clientes")
			.update({
				consentimentoRGPD: true,
				consentimentoData: agora,
			})
			.eq("id", consentimento.clienteId);

		if (clienteError) {
			return NextResponse.json({ error: clienteError.message }, { status: 500 });
		}

		logAudit("consent.accepted", "consentimento", consentimento.clienteId, null, null, req, {
			consentimentoId: consentimento.id,
			ip,
		});

		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
	}
}
