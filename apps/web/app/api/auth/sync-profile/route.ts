import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
	throw new Error("Missing SUPABASE env vars for sync-profile");
}

const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
	auth: { persistSession: false },
});

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { userId, email, name, tenantId, role } = body;

		if (!userId) {
			return NextResponse.json(
				{ error: "userId required" },
				{ status: 400 },
			);
		}

		// Adjust column names to your schema: uses camelCase columns (e.g., "tenantId", "name", etc.)
		// Upsert by id to ensure profiles.id = auth.uid()
		const payload: Record<string, unknown> = {
			id: userId,
			email,
			name,
			// if you want to set default role, remove or set accordingly
			role: role ?? "partner",
		};

		if (tenantId) {
			payload.tenantId = tenantId;
		}

		// Do an upsert: if id exists do nothing (or update certain fields)
		// Using rpc/insert via supabase client
		const { data, error } = await serviceSupabase
			.from("profiles")
			.upsert(payload, { onConflict: "id" })
			.select();

		if (error) {
			console.error("sync-profile error", error);
			return NextResponse.json({ error }, { status: 500 });
		}

		return NextResponse.json({ data });
	} catch (err) {
		console.error("sync-profile exception", err);
		return NextResponse.json({ error: "internal" }, { status: 500 });
	}
}
