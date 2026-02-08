import { createClient } from "@supabase/supabase-js";

export interface AuthClientErrorCodes {
	INVALID_EMAIL_OR_PASSWORD: string;
	USER_NOT_FOUND: string;
	FAILED_TO_CREATE_USER: string;
	FAILED_TO_CREATE_SESSION: string;
	FAILED_TO_UPDATE_USER: string;
	FAILED_TO_GET_SESSION: string;
	INVALID_PASSWORD: string;
	INVALID_EMAIL: string;
	INVALID_TOKEN: string;
	CREDENTIAL_ACCOUNT_NOT_FOUND: string;
	EMAIL_CAN_NOT_BE_UPDATED: string;
	EMAIL_NOT_VERIFIED: string;
	FAILED_TO_GET_USER_INFO: string;
	ID_TOKEN_NOT_SUPPORTED: string;
	PASSWORD_TOO_LONG: string;
	PASSWORD_TOO_SHORT: string;
	PROVIDER_NOT_FOUND: string;
	SOCIAL_ACCOUNT_ALREADY_LINKED: string;
	USER_EMAIL_NOT_FOUND: string;
	USER_ALREADY_EXISTS: string;
	INVALID_INVITATION: string;
	SESSION_EXPIRED: string;
	FAILED_TO_UNLINK_LAST_ACCOUNT: string;
	ACCOUNT_NOT_FOUND: string;
}

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
					body: JSON.stringify({ name: res.data.user.user_metadata?.name }),
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
		async social({ provider, callbackURL }: { provider: string; callbackURL?: string }) {
			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: provider as 'google' | 'github' | 'facebook',
				options: { redirectTo: callbackURL },
			});
			return { data, error };
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
					body: JSON.stringify({ name }),
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
		async list(): Promise<{ data: Array<{ id: string; name: string; slug: string; logo?: string | null; createdAt: Date; metadata?: unknown }> | null; error: { message: string } | null }> {
			console.warn("organization.list not implemented");
			return { data: [], error: null };
		},
		async getFullOrganization({ query }: { query: { organizationId?: string; organizationSlug?: string } }): Promise<{
			data: {
				id: string;
				name: string;
				slug: string;
				logo?: string | null;
				createdAt: Date;
				metadata?: unknown;
				members: Array<{ id: string; organizationId: string; userId: string; role: "admin" | "member" | "owner"; createdAt: Date; user: { email: string; name: string; image?: string } }>;
				invitations: Array<{ id: string; email: string; role: "admin" | "member" | "owner"; organizationId: string; status: "pending" | "accepted" | "rejected" | "canceled"; inviterId: string; expiresAt: Date; createdAt?: Date }>;
			} | null;
			error: { message: string } | null;
		}> {
			console.warn("organization.getFullOrganization not implemented", query);
			return { data: null, error: null };
		},
		async delete({ organizationId }: { organizationId: string }) {
			console.warn("organization.delete not implemented", organizationId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async removeMember({ memberIdOrEmail, organizationId }: { memberIdOrEmail: string; organizationId: string }) {
			console.warn("organization.removeMember not implemented", memberIdOrEmail, organizationId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async updateMemberRole({ memberId, organizationId, role }: { memberId: string; organizationId: string; role: string }) {
			console.warn("organization.updateMemberRole not implemented", memberId, organizationId, role);
			return { data: null, error: { message: "Not implemented" } };
		},
		async inviteMember({ email, organizationId, role }: { email: string; organizationId: string; role: string }) {
			console.warn("organization.inviteMember not implemented", email, organizationId, role);
			return { data: null, error: { message: "Not implemented" } };
		},
		async cancelInvitation({ invitationId }: { invitationId: string }) {
			console.warn("organization.cancelInvitation not implemented", invitationId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async rejectInvitation({ invitationId }: { invitationId: string }) {
			console.warn("organization.rejectInvitation not implemented", invitationId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async update({ organizationId, data }: { organizationId: string; data: Record<string, unknown> }) {
			console.warn("organization.update not implemented", organizationId, data);
			return { data: null, error: { message: "Not implemented" } };
		},
		async create({ name, slug, metadata }: { name: string; slug: string; metadata?: unknown }): Promise<{ data: { id: string; name: string; slug: string } | null; error: { message: string } | null }> {
			console.warn("organization.create not implemented", name, slug, metadata);
			return { data: null, error: { message: "Not implemented" } };
		},
		async setActive({ organizationId, organizationSlug }: { organizationId?: string | null; organizationSlug?: string }): Promise<{ data: { id: string; slug: string } | null; error: { message: string } | null }> {
			console.warn("organization.setActive not implemented", organizationId, organizationSlug);
			return { data: null, error: null };
		},
	},

	passkey: {
		async addPasskey(options?: { fetchOptions?: { onSuccess?: () => void; onError?: (error: unknown) => void } }) {
			console.warn("passkey.addPasskey not implemented", options);
			if (options?.fetchOptions?.onSuccess) {
				options.fetchOptions.onSuccess();
			}
			return { data: null, error: { message: "Not implemented" } };
		},
		async deletePasskey({ id }: { id: string }) {
			console.warn("passkey.deletePasskey not implemented", id);
			return { data: null, error: { message: "Not implemented" } };
		},
		async listUserPasskeys(): Promise<{ data: Array<{ id: string; name?: string; deviceType?: string; createdAt: Date }> | null; error: { message: string } | null }> {
			console.warn("passkey.listUserPasskeys not implemented");
			return { data: [], error: null };
		},
	},

	async changeEmail({ newEmail }: { newEmail: string }) {
		const { error } = await supabase.auth.updateUser({ email: newEmail });
		return { data: error ? null : { success: true }, error };
	},

	async changePassword({ currentPassword, newPassword, revokeOtherSessions }: { currentPassword: string; newPassword: string; revokeOtherSessions?: boolean }) {
		// Re-authenticate with current password first
		const { data: { user } } = await supabase.auth.getUser();
		if (!user?.email) {
			return { data: null, error: { message: "No authenticated user found" } };
		}

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email: user.email,
			password: currentPassword,
		});
		if (signInError) {
			return { data: null, error: { message: "Current password is incorrect" } };
		}

		const { error } = await supabase.auth.updateUser({ password: newPassword });
		if (error) return { data: null, error };

		if (revokeOtherSessions) {
			await supabase.auth.signOut({ scope: "others" });
		}

		return { data: { success: true }, error: null };
	},

	async updateUser({ name, image, onboardingComplete, locale }: { name?: string; image?: string; onboardingComplete?: boolean; locale?: string }) {
		const { data, error } = await supabase.auth.updateUser({
			data: { name, avatar_url: image, onboardingComplete, locale },
		});
		return { data, error };
	},

	async deleteUser(options?: Record<string, unknown>) {
		console.warn("deleteUser not implemented", options);
		return { data: null, error: { message: "Not implemented" } };
	},

	async unlinkAccount({ providerId }: { providerId: string }) {
		console.warn("unlinkAccount not implemented", providerId);
		return { data: null, error: { message: "Not implemented" } };
	},

	async linkSocial({ provider, callbackURL }: { provider: string; callbackURL?: string }) {
		console.warn("linkSocial not implemented", provider, callbackURL);
		return { data: null, error: { message: "Not implemented" } };
	},

	admin: {
		async impersonateUser({ userId }: { userId: string }) {
			console.warn("admin.impersonateUser not implemented", userId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async stopImpersonating() {
			console.warn("admin.stopImpersonating not implemented");
			return { data: null, error: null };
		},
		async banUser({ userId }: { userId: string }) {
			console.warn("admin.banUser not implemented", userId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async unbanUser({ userId }: { userId: string }) {
			console.warn("admin.unbanUser not implemented", userId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async removeUser({ userId }: { userId: string }) {
			console.warn("admin.removeUser not implemented", userId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async setRole({ userId, role }: { userId: string; role: string }) {
			console.warn("admin.setRole not implemented", userId, role);
			return { data: null, error: { message: "Not implemented" } };
		},
		async revokeSession({ sessionId }: { sessionId: string }) {
			console.warn("admin.revokeSession not implemented", sessionId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async revokeSessions({ userId }: { userId: string }) {
			console.warn("admin.revokeSessions not implemented", userId);
			return { data: null, error: { message: "Not implemented" } };
		},
		async listUsers(): Promise<{
			data: {
				users: Array<{
					id: string;
					email: string;
					name: string;
					username: string | null;
					image: string | null;
					role: string | null;
					locale: string | null;
					banned: boolean | null;
					banReason: string | null;
					banExpires: Date | null;
					emailVerified: boolean;
					twoFactorEnabled: boolean | null;
					createdAt: Date;
					updatedAt: Date;
				}>;
				total: number;
			} | null;
			error: { message: string } | null;
		}> {
			console.warn("admin.listUsers not implemented");
			return { data: { users: [], total: 0 }, error: null };
		},
		async listSessions({ userId }: { userId: string }): Promise<{
			data: Array<{ id: string; userId: string; createdAt: Date; expiresAt: Date; userAgent?: string; ipAddress?: string }> | null;
			error: { message: string } | null;
		}> {
			console.warn("admin.listSessions not implemented", userId);
			return { data: [], error: null };
		},
	},

	twoFactor: {
		async enable({ password }: { password: string }): Promise<{ data: { totpURI?: string; backupCodes?: string[] } | null; error: { message: string } | null }> {
			console.warn("twoFactor.enable not implemented", password);
			return { data: null, error: { message: "Not implemented" } };
		},
		async disable({ password }: { password: string }) {
			console.warn("twoFactor.disable not implemented", password);
			return { data: null, error: { message: "Not implemented" } };
		},
		async verifyTotp({ code }: { code: string }) {
			console.warn("twoFactor.verifyTotp not implemented", code);
			return { data: null, error: { message: "Not implemented" } };
		},
	},

	useSession: () => {
		// Return a mock hook-like object
		return {
			data: null,
			isPending: false,
			error: null,
		};
	},

	async sendVerificationEmail({ email }: { email: string }) {
		console.warn("sendVerificationEmail not implemented", email);
		return { data: null, error: { message: "Not implemented" } };
	},

	async forgetPassword({ email, redirectTo }: { email: string; redirectTo?: string }, options?: { onSuccess?: () => void; onError?: (error: unknown) => void; onResponse?: () => void }) {
		const { error } = await supabase.auth.resetPasswordForEmail(email, {
			redirectTo,
		});
		if (error) {
			if (options?.onError) options.onError(error);
		} else {
			if (options?.onSuccess) options.onSuccess();
		}
		if (options?.onResponse) options.onResponse();
		return { data: error ? null : { success: true }, error };
	},

	async resetPassword({ token, newPassword }: { token?: string; newPassword: string }) {
		const { error } = await supabase.auth.updateUser({ password: newPassword });
		return { data: error ? null : { success: true }, error };
	},

	async signOut(options?: { fetchOptions?: { onSuccess?: () => void } }) {
		const { error } = await supabase.auth.signOut();
		if (!error && options?.fetchOptions?.onSuccess) {
			options.fetchOptions.onSuccess();
		}
		return { error };
	},

	async getSession(options?: { query?: { disableCookieCache?: boolean } }) {
		const { data, error } = await supabase.auth.getSession();
		return { data: data.session, error };
	},

	async listAccounts(): Promise<{ data: Array<{ id: string; providerId: string }> | null; error: { message: string } | null }> {
		console.warn("listAccounts not implemented");
		return { data: [], error: null };
	},

	async listSessions(): Promise<{ data: Array<{ id: string; token: string; createdAt: Date; expiresAt: Date; userAgent?: string; ipAddress?: string }> | null; error: { message: string } | null }> {
		console.warn("listSessions not implemented");
		return { data: [], error: null };
	},

	async revokeSession({ id, token }: { id?: string; token?: string }, options?: { onSuccess?: () => void }) {
		console.warn("revokeSession not implemented", id, token);
		if (options?.onSuccess) {
			options.onSuccess();
		}
		return { data: null, error: null };
	},

	async revokeSessions() {
		console.warn("revokeSessions not implemented");
		return { data: null, error: null };
	},

	_supabase: supabase,
};
