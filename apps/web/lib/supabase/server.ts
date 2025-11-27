// lib/supabase/server.ts - CORRIGIDO
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error("Missing Supabase environment variables");
}

// Agora TypeScript sabe que são strings
const validatedSupabaseUrl: string = supabaseUrl;
const validatedSupabaseAnonKey: string = supabaseAnonKey;

export function createServerClient() {
	cookies(); // Mantemos para garantir que cookies são carregados

	return createClient(validatedSupabaseUrl, validatedSupabaseAnonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: false,
		},
	});
}
