import { config } from "@repo/config";
import {
	db,
	getInvitationById,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	getUserByEmail,
} from "@repo/database";
import type { Locale } from "@repo/i18n";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { cancelSubscription } from "@repo/payments";
import { getBaseUrl } from "@repo/utils";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
	admin,
	createAuthMiddleware,
	magicLink,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { parse as parseCookies } from "cookie";
import { updateSeatsInOrganizationSubscription } from "./lib/organization";
import { invitationOnlyPlugin } from "./plugins/invitation-only";
import { passwordPolicyPlugin } from "./plugins/password-policy";

const getLocaleFromRequest = (request?: Request) => {
	const cookies = parseCookies(request?.headers.get("cookie") ?? "");
	return (
		(cookies[config.i18n.localeCookieName] as Locale) ??
		config.i18n.defaultLocale
	);
};

const appUrl = getBaseUrl();

export const auth = betterAuth({
	baseURL: appUrl,
	trustedOrigins: [appUrl],
	appName: config.appName,
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	advanced: {
		database: {
			generateId: false,
		},
	},
	session: {
		expiresIn: config.auth.sessionCookieMaxAge,
		freshAge: 0,
	},
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google", "github"],
		},
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			// ---------- ACCEPT INVITATION HANDLER ----------
			if (ctx.path.startsWith("/organization/accept-invitation")) {
				const { invitationId } = ctx.body;

				if (!invitationId) {
					return;
				}

				const invitation = await getInvitationById(invitationId);

				if (!invitation) {
					return;
				}

				// Manutenção original: atualizar seats
				await updateSeatsInOrganizationSubscription(
					invitation.organizationId,
				);

				// ----------------- NOVO: sincroniza com tabela `profiles` -----------------
				try {
					// Tenta obter o userId do contexto de sessão (usuário que aceitou)
					const userId =
						ctx.context?.session?.session?.userId ??
						ctx.body?.userId ??
						undefined;

					// Determina email possível do corpo ou do convite
					const userEmail =
						ctx.body?.email ?? invitation.email ?? undefined;

					// Tenta obter nome (pode vir no body se aceitando via UI)
					const userName = ctx.body?.name ?? undefined;

					// Determina role a aplicar no profile: tenta meta do convite, senão "member"
					const invitedRole =
						(invitation as any)?.role ??
						(invitation as any)?.meta?.role ??
						"member";

					// Primeiro: procura profile existente por id (quando temos) ou email (fallback)
					let existingProfile: any = null;
					if (userId) {
						// busca por id
						try {
							const rows: any[] = await db.$queryRaw`
								SELECT id, email, role, "tenantId", name
								FROM profiles
								WHERE id = ${userId}
								LIMIT 1
							`;
							if (rows && rows.length > 0) {
								existingProfile = rows[0];
							}
						} catch (err) {
							logger.warn(
								"db.$queryRaw error when checking profile by id",
								{
									err,
									userId,
								},
							);
						}
					}

					if (!existingProfile && userEmail) {
						try {
							const rowsByEmail: any[] = await db.$queryRaw`
								SELECT id, email, role, "tenantId", name
								FROM profiles
								WHERE email = ${userEmail}
								LIMIT 1
							`;
							if (rowsByEmail && rowsByEmail.length > 0) {
								existingProfile = rowsByEmail[0];
							}
						} catch (err) {
							logger.warn(
								"db.$queryRaw error when checking profile by email",
								{
									err,
									userEmail,
								},
							);
						}
					}

					// Se não existe, inserimos um novo registro em profiles
					if (!existingProfile) {
						// Monta columns e values dinamicamente (para lidar com userId opcional)
						if (userId) {
							// Inserir com id
							try {
								await db.$executeRaw`
									INSERT INTO profiles (id, tenant_id, email, nome, role, created_at)
									VALUES (${userId}, ${invitation.organizationId}, ${userEmail}, ${userName}, ${invitedRole}, NOW())
									ON CONFLICT (id) DO NOTHING
								`;
								logger.info(
									"Inserted profile with id for invited user",
									{
										userId,
										email: userEmail,
										tenantId: invitation.organizationId,
										invitedRole,
									},
								);
							} catch (err) {
								logger.error(
									"Failed to insert profile with id",
									{
										err,
										userId,
										userEmail,
										invitationId,
									},
								);
							}
						} else {
							// Inserir sem id (Postgres gerará id se houver trigger/serial — aqui assumimos id text, então precisa inserir id manualmente. Se sua tabela exige id, você deve ajustar.)
							// Neste caso vamos inserir sem id apenas se a coluna id for gerada por banco; caso contrário, a inserção pode falhar.
							try {
								await db.$executeRaw`
									INSERT INTO profiles (tenant_id, email, nome, role, created_at)
									VALUES (${invitation.organizationId}, ${userEmail}, ${userName}, ${invitedRole}, NOW())
									ON CONFLICT (email) DO NOTHING
								`;
								logger.info(
									"Inserted profile by email for invited user (no userId available)",
									{
										email: userEmail,
										tenantId: invitation.organizationId,
										invitedRole,
									},
								);
							} catch (err) {
								logger.error(
									"Failed to insert profile by email (no userId)",
									{
										err,
										userEmail,
										invitationId,
									},
								);
							}
						}
					} else {
						// profile já existe — se tenant_id for diferente, atualiza
						logger.info("Profile already exists for invited user", {
							profileId: existingProfile.id,
							email: existingProfile.email,
							currentTenant: existingProfile.tenant_id,
							invitationTenant: invitation.organizationId,
						});
						try {
							if (
								existingProfile.tenant_id !==
								invitation.organizationId
							) {
								await db.$executeRaw`
									UPDATE profiles
									SET tenant_id = ${invitation.organizationId}
									WHERE id = ${existingProfile.id}
								`;
								logger.info(
									"Updated profile.tenant_id to invitation.organizationId",
									{
										profileId: existingProfile.id,
										tenantId: invitation.organizationId,
									},
								);
							}
						} catch (err) {
							logger.warn("Failed to update profile tenant_id", {
								err,
								profileId: existingProfile.id,
							});
						}
					}
				} catch (err) {
					// Nunca interromper o fluxo principal
					logger.error(
						"Error while creating/updating profile for invited user",
						{
							err,
							ctxBody: ctx.body,
							invitationId,
						},
					);
				}

				// ----------------- FIM DO BLOCO profiles -----------------
			} else if (ctx.path.startsWith("/organization/remove-member")) {
				const { organizationId } = ctx.body;

				if (!organizationId) {
					return;
				}

				await updateSeatsInOrganizationSubscription(organizationId);
			}
		}),
		before: createAuthMiddleware(async (ctx) => {
			if (
				ctx.path.startsWith("/delete-user") ||
				ctx.path.startsWith("/organization/delete")
			) {
				const userId = ctx.context.session?.session.userId;
				const { organizationId } = ctx.body;

				if (userId || organizationId) {
					const purchases = organizationId
						? await getPurchasesByOrganizationId(organizationId)
						: // biome-ignore lint/style/noNonNullAssertion: This is a valid case
							await getPurchasesByUserId(userId!);
					const subscriptions = purchases.filter(
						(purchase) =>
							purchase.type === "SUBSCRIPTION" &&
							purchase.subscriptionId !== null,
					);

					if (subscriptions.length > 0) {
						for (const subscription of subscriptions) {
							await cancelSubscription(
								// biome-ignore lint/style/noNonNullAssertion: This is a valid case
								subscription.subscriptionId!,
							);
						}
					}
				}
			}
		}),
	},
	user: {
		additionalFields: {
			onboardingComplete: {
				type: "boolean",
				required: false,
			},
			locale: {
				type: "string",
				required: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
		changeEmail: {
			enabled: true,
			sendChangeEmailVerification: async (
				{ user: { email, name }, url },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				await sendEmail({
					to: email,
					templateId: "emailVerification",
					context: {
						url,
						name,
					},
					locale,
				});
			},
		},
	},
	emailAndPassword: {
		enabled: true,
		// If signup is disabled, the only way to sign up is via an invitation. So in this case we can auto sign in the user, as the email is already verified by the invitation.
		// If signup is enabled, we can't auto sign in the user, as the email is not verified yet.
		autoSignIn: !config.auth.enableSignup,
		requireEmailVerification: config.auth.enableSignup,
		sendResetPassword: async ({ user, url }, request) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: user.email,
				templateId: "forgotPassword",
				context: {
					url,
					name: user.name,
				},
				locale,
			});
		},
	},
	emailVerification: {
		sendOnSignUp: config.auth.enableSignup,
		autoSignInAfterVerification: true,
		sendVerificationEmail: async (
			{ user: { email, name }, url },
			request,
		) => {
			const locale = getLocaleFromRequest(request);
			await sendEmail({
				to: email,
				templateId: "emailVerification",
				context: {
					url,
					name,
				},
				locale,
			});
		},
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID as string,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
			scope: ["email", "profile"],
		},
		github: {
			clientId: process.env.GITHUB_CLIENT_ID as string,
			clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
			scope: ["user:email"],
		},
	},
	plugins: [
		username(),
		admin(),
		passkey(),
		magicLink({
			disableSignUp: false,
			sendMagicLink: async ({ email, url }, ctx) => {
				const locale = getLocaleFromRequest(ctx?.request);
				await sendEmail({
					to: email,
					templateId: "magicLink",
					context: {
						url,
					},
					locale,
				});
			},
		}),
		organization({
			sendInvitationEmail: async (
				{ email, id, organization },
				request,
			) => {
				const locale = getLocaleFromRequest(request);
				const existingUser = await getUserByEmail(email);

				const url = new URL(
					existingUser ? "/auth/login" : "/auth/signup",
					getBaseUrl(),
				);

				url.searchParams.set("invitationId", id);
				url.searchParams.set("email", email);

				await sendEmail({
					to: email,
					templateId: "organizationInvitation",
					locale,
					context: {
						organizationName: organization.name,
						url: url.toString(),
					},
				});
			},
		}),
		openAPI(),
		passwordPolicyPlugin(),
		invitationOnlyPlugin(),
		twoFactor(),
	],
	onAPIError: {
		onError(error, ctx) {
			logger.error(error, { ctx });
		},
	},
});

export * from "./lib/organization";

export type Session = typeof auth.$Infer.Session;

export type ActiveOrganization = NonNullable<
	Awaited<ReturnType<typeof auth.api.getFullOrganization>>
>;

export type Organization = typeof auth.$Infer.Organization;

export type OrganizationMemberRole =
	ActiveOrganization["members"][number]["role"];

export type OrganizationInvitationStatus = typeof auth.$Infer.Invitation.status;

export type OrganizationMetadata = Record<string, unknown> | undefined;
