import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const token = searchParams.get("token");

		if (!token) {
			return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
		}

		const serviceSupabase = getServiceSupabase();

		const { data: consentimento } = await serviceSupabase
			.from("consentimentos")
			.select("id, clienteId, status, expiraEm, aceitoEm")
			.eq("token", token)
			.single();

		// Token inexistente — resposta idêntica a expirado para evitar enumeração
		if (!consentimento) {
			return NextResponse.json({ status: "invalido", expirado: false, clienteNome: null });
		}

		const expirado = new Date(consentimento.expiraEm) < new Date();
		const statusFinal = expirado && consentimento.status === "pendente" ? "expirado" : consentimento.status;

		// Só mostrar nome do cliente para consentimentos pendentes (não expirados)
		let clienteNome: string | null = null;
		if (consentimento.status === "pendente" && !expirado) {
			const { data: cliente } = await serviceSupabase
				.from("clientes")
				.select("name")
				.eq("id", consentimento.clienteId)
				.single();

			const nomeCompleto = cliente?.name || "";
			clienteNome = nomeCompleto.split(" ")[0] || null;
		}

		return NextResponse.json({
			status: statusFinal,
			expirado,
			clienteNome,
		});
	} catch (err: any) {
		return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
	}
}
