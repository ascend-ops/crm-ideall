import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { createAuthMiddleware } from "better-auth/plugins";
import { validatePassword } from "../../lib/password-policy";

export const passwordPolicyPlugin = () =>
	({
		id: "passwordPolicyPlugin",
		hooks: {
			before: [
				{
					matcher: (context) =>
						context.path.startsWith("/sign-up/email"),
					handler: createAuthMiddleware(async (ctx) => {
						const { password } = ctx.body;

						if (!password) {
							throw new APIError("BAD_REQUEST", {
								code: "WEAK_PASSWORD",
								message: "Password is required",
							});
						}

						const result = validatePassword(password);
						if (!result.valid) {
							throw new APIError("BAD_REQUEST", {
								code: "WEAK_PASSWORD",
								message: result.error!,
							});
						}
					}),
				},
			],
		},
		$ERROR_CODES: {
			WEAK_PASSWORD:
				"Password does not meet the required complexity",
		},
	}) satisfies BetterAuthPlugin;
