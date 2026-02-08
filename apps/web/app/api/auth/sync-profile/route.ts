import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function getServiceSupabase() {
	const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
		throw new Error("Missing SUPABASE env vars for sync-profile");
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

	const { data: { user }, error } = await supabase.auth.getUser();
	if (error || !user) return null;
	return user;
}

export async function POST(req: Request) {
	const serviceSupabase = getServiceSupabase();
	try {
		// Verify the caller is authenticated
		const authenticatedUser = await getAuthenticatedUser();
		if (!authenticatedUser) {
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		}

		const body = await req.json();
		const { name } = body;

		// Only allow syncing the caller's own profile -- never accept userId, role, or tenantId from the client
		const userId = authenticatedUser.id;
		const email = authenticatedUser.email;

		// Check if profile already exists
		const { data: existing } = await serviceSupabase
			.from("profiles")
			.select("id, role, tenantId")
			.eq("id", userId)
			.single();

		const payload: Record<string, unknown> = {
			id: userId,
			email,
			name: name || authenticatedUser.user_metadata?.name || email,
		};

		// Preserve existing role and tenantId -- never allow client to override
		if (existing) {
			payload.role = existing.role;
			payload.tenantId = existing.tenantId;
		} else {
			payload.role = "parceiro";
		}

		const { data, error } = await serviceSupabase
			.from("profiles")
			.upsert(payload, { onConflict: "id" })
			.select("id, email, name, role, tenantId");

		if (error) {
			console.error("sync-profile error");
			return NextResponse.json({ error: "Failed to sync profile" }, { status: 500 });
		}

		return NextResponse.json({ data });
	} catch (err) {
		console.error("sync-profile exception");
		return NextResponse.json({ error: "internal" }, { status: 500 });
	}
}
