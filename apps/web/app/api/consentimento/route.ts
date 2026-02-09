import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { logAudit } from "../../../lib/audit-log";

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

async function getAuthenticatedUser() {
	const cookieStore = await cookies();
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						for (const { name, value, options } of cookiesToSet) {
							cookieStore.set(name, value, options);
						}
					} catch {
						// Ignore in read-only context
					}
				},
			},
		},
	);

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error || !user) return null;
	return user;
}

function getSiteUrl() {
	if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return "http://localhost:4000";
}

export async function POST(req: Request) {
	try {
		const authenticatedUser = await getAuthenticatedUser();
		if (!authenticatedUser) {
			return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
		}

		const serviceSupabase = getServiceSupabase();

		// Verificar role (tenant ou gestor) e obter tenantId
		const { data: profile } = await serviceSupabase
			.from("profiles")
			.select("id, role, tenantId")
			.eq("email", authenticatedUser.email)
			.single();

		if (!profile || (profile.role !== "tenant" && profile.role !== "gestor")) {
			return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
		}

		const tenantId = profile.tenantId || profile.id;

		const { clienteId } = await req.json();
		if (!clienteId) {
			return NextResponse.json({ error: "clienteId obrigatório" }, { status: 400 });
		}

		// Verificar se o cliente existe E pertence ao tenant
		const { data: cliente } = await serviceSupabase
			.from("clientes")
			.select("id")
			.eq("id", clienteId)
			.eq("tenantId", tenantId)
			.single();

		if (!cliente) {
			return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
		}

		const token = crypto.randomUUID();
		const expiraEm = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

		// Verificar se já existe consentimento pendente
		const { data: existente } = await serviceSupabase
			.from("consentimentos")
			.select("id, tentativas")
			.eq("clienteId", clienteId)
			.eq("status", "pendente")
			.order("criadoEm", { ascending: false })
			.limit(1)
			.single();

		if (existente) {
			// Actualizar o existente com novo token e incrementar tentativas
			await serviceSupabase
				.from("consentimentos")
				.update({
					token,
					expiraEm,
					tentativas: existente.tentativas + 1,
					updatedAt: new Date().toISOString(),
				})
				.eq("id", existente.id);
		} else {
			// Criar novo consentimento
			const { error: insertError } = await serviceSupabase
				.from("consentimentos")
				.insert({
					clienteId,
					token,
					status: "pendente",
					textoVersao: "v1.0",
					expiraEm,
					tentativas: 1,
				});

			if (insertError) {
				return NextResponse.json({ error: insertError.message }, { status: 500 });
			}
		}

		const siteUrl = getSiteUrl();
		const link = `${siteUrl}/consentimento?token=${token}`;

		logAudit("consent.generated", "consentimento", clienteId, profile.id, tenantId, req, {
			tentativa: existente ? existente.tentativas + 1 : 1,
		});

		return NextResponse.json({ token, link });
	} catch (err: any) {
		console.error("[RGPD] Erro ao gerar consentimento:", err);
		return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
	}
}
