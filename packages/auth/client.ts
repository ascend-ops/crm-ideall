import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	throw new Error("Missing NEXT_PUBLIC_SUPABASE_* env variables");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: { persistSession: true },
});

export const authClient = {
	signIn: {
		async email({ email, password }: { email: string; password: string }) {
			const res = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (res.data?.user?.id) {
				fetch("/api/auth/sync-profile", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: res.data.user.id, email }),
				}).catch(() => {});
			}

			return { data: res.data, error: res.error };
		},

		async magicLink({
			email,
			callbackURL,
		}: {
			email: string;
			callbackURL?: string;
		}) {
			const res = await supabase.auth.signInWithOtp({
				email,
				options: { emailRedirectTo: callbackURL },
			});
			return { data: res.data, error: res.error };
		},

		async passkey() {
			return Promise.reject(
				new Error("passkey not implemented in authClient"),
			);
		},
	},

	signUp: {
		async email({
			email,
			password,
			name,
			callbackURL,
		}: {
			email: string;
			password?: string;
			name?: string;
			callbackURL?: string;
		}) {
			if (!password) {
				throw new Error("Password is required");
			}

			const res = await supabase.auth.signUp({
				email,
				password,
				options: { emailRedirectTo: callbackURL, data: { name } },
			});

			if (res.data?.user?.id) {
				fetch("/api/auth/sync-profile", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						userId: res.data.user.id,
						email,
						name,
					}),
				}).catch(() => {});
			}

			return { data: res.data, error: res.error };
		},
	},

	organization: {
		async acceptInvitation({ invitationId }: { invitationId: string }) {
			const res = await fetch("/api/organization/accept-invitation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ invitationId }),
			});

			if (!res.ok) {
				const json = await res.json().catch(() => ({}));
				return { data: null, error: json };
			}

			return { data: await res.json(), error: null };
		},
	},

	_supabase: supabase,
};
