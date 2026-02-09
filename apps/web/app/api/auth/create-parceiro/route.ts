import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withRateLimit } from "../../../../lib/rate-limit";

function getServiceSupabase() {
	const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
		throw new Error("Missing SUPABASE env vars for create-parceiro");
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

export async function POST(req: Request) {
	const rateLimitResponse = withRateLimit(req, { maxRequests: 5, windowMs: 300_000 });
	if (rateLimitResponse) return rateLimitResponse;

	try {
		// 1. Verificar autenticação
		const authenticatedUser = await getAuthenticatedUser();
		if (!authenticatedUser) {
			return NextResponse.json(
				{ error: "Não autenticado" },
				{ status: 401 },
			);
		}

		const serviceSupabase = getServiceSupabase();

		// 2. Verificar que o chamador é tenant (admin)
		const { data: callerProfile, error: profileError } =
			await serviceSupabase
				.from("profiles")
				.select("id, role, tenantId")
				.eq("id", authenticatedUser.id)
				.single();

		if (profileError || !callerProfile) {
			return NextResponse.json(
				{ error: "Perfil não encontrado" },
				{ status: 403 },
			);
		}

		if (callerProfile.role !== "tenant") {
			return NextResponse.json(
				{ error: "Apenas administradores podem criar parceiros" },
				{ status: 403 },
			);
		}

		// 3. Ler dados do body
		const body = await req.json();
		const { name, email, password, telefone, endereco, localidade, codigoPostal } = body;

		if (!name || !email || !password) {
			return NextResponse.json(
				{ error: "Nome, email e palavra-passe são obrigatórios" },
				{ status: 400 },
			);
		}

		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return NextResponse.json(
				{ error: "Formato de email inválido" },
				{ status: 400 },
			);
		}

		if (
			password.length < 8 ||
			!/[A-Z]/.test(password) ||
			!/[a-z]/.test(password) ||
			!/[0-9]/.test(password)
		) {
			return NextResponse.json(
				{ error: "A palavra-passe deve ter pelo menos 8 caracteres, incluindo 1 maiúscula, 1 minúscula e 1 número" },
				{ status: 400 },
			);
		}

		// 4. Criar utilizador no Supabase Auth
		const { data: authData, error: authError } =
			await serviceSupabase.auth.admin.createUser({
				email,
				password,
				email_confirm: true,
				user_metadata: { role: "parceiro" },
			});

		if (authError) {
			console.error("Erro ao criar utilizador auth");
			if (authError.message?.includes("already been registered")) {
				return NextResponse.json(
					{ error: "Este email já está registado" },
					{ status: 409 },
				);
			}
			return NextResponse.json(
				{ error: `Erro ao criar utilizador: ${authError.message}` },
				{ status: 500 },
			);
		}

		if (!authData.user) {
			return NextResponse.json(
				{ error: "Falha ao criar utilizador" },
				{ status: 500 },
			);
		}

		// 5. Criar perfil na tabela profiles
		// tenantId do parceiro = id do admin (o tenant's profile.id É o tenantId)
		const { data: profileData, error: insertError } =
			await serviceSupabase
				.from("profiles")
				.insert({
					id: authData.user.id,
					name,
					email,
					role: "parceiro",
					tenantId: callerProfile.id,
					telefone: telefone || null,
					endereco: endereco || null,
					localidade: localidade || null,
					codigoPostal: codigoPostal || null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				})
				.select()
				.single();

		if (insertError) {
			console.error("Erro ao criar perfil");
			// Rollback: eliminar utilizador auth se o perfil falhou
			await serviceSupabase.auth.admin.deleteUser(authData.user.id);
			return NextResponse.json(
				{ error: `Erro ao criar perfil: ${insertError.message}` },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			data: profileData,
			message: "Parceiro criado com sucesso",
		});
	} catch (err) {
		console.error("create-parceiro exception");
		return NextResponse.json(
			{ error: "Erro interno do servidor" },
			{ status: 500 },
		);
	}
}
