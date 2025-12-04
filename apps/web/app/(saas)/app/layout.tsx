import { config } from "@repo/config";
import { getSession } from "@saas/auth/lib/server";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Layout({ children }: PropsWithChildren) {
	console.log("🔍 App Layout - verificando sessão...");
	const session = await getSession();
	console.log("🔍 App Layout - sessão:", session ? "EXISTE" : "NÃO EXISTE");

	if (!session) {
		console.log("❌ App Layout - REDIRECIONANDO para login");
		redirect("/auth/login");
	}

	// COMENTADO TEMPORARIAMENTE - depende da estrutura do Better Auth
	// if (config.users.enableOnboarding && !session.user.onboardingComplete) {
	// 	redirect("/onboarding");
	// }

	// COMENTADO TEMPORARIAMENTE - getOrganizationList pode não funcionar ainda
	// const organizations = await getOrganizationList();

	// COMENTADO TEMPORARIAMENTE - depende de organizations
	// if (
	// 	config.organizations.enable &&
	// 	config.organizations.requireOrganization
	// ) {
	// 	const organization =
	// 		organizations.find(
	// 			(org: { id: string | undefined; }) => org.id === session?.user?.id,
	// 		) || organizations[0];

	// 	if (!organization) {
	// 		redirect("/new-organization");
	// 	}
	// }

	const hasFreePlan = Object.values(config.payments.plans).some(
		(plan) => "isFree" in plan,
	);

	// COMENTADO TEMPORARIAMENTE - depende de organizations e session structure
	// if (
	// 	((config.organizations.enable && config.organizations.enableBilling) ||
	// 		config.users.enableBilling) &&
	// 	!hasFreePlan
	// ) {
	// 	const organizationId = config.organizations.enable
	// 		? session?.user?.id || organizations?.at(0)?.id
	// 		: undefined;

	// 	const [error, data] = await attemptAsync(() =>
	// 		orpcClient.payments.listPurchases({
	// 			organizationId,
	// 		}),
	// 	);

	// 	if (error) {
	// 		throw new Error("Failed to fetch purchases");
	// 	}

	// 	const purchases = data?.purchases ?? [];

	// 	const { activePlan } = createPurchasesHelper(purchases);

	// 	if (!activePlan) {
	// 		redirect("/choose-plan");
	// 	}
	// }

	return children;
}
