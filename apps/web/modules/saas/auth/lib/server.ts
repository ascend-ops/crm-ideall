import "server-only";
import { getInvitationById } from "@repo/database";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// NOVA FUNÇÃO getSession usando Supabase
export const getSession = cache(async () => {
	try {
		const cookieStore = await cookies();

		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return cookieStore.getAll();
					},
					setAll() {
						// ⚠️ IGNORA a modificação de cookies em componentes
						// Cookies só podem ser modificados em Server Actions ou Route Handlers
						return;
					},
				},
			},
		);

		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();

		if (error) {
			console.error("❌ Erro ao obter sessão do Supabase:", error);
			return null;
		}

		console.log(
			"🔐 Sessão no servidor (Supabase):",
			session ? "EXISTE" : "NÃO EXISTE",
		);
		return session;
	} catch (error) {
		console.error("💥 Erro inesperado ao obter sessão:", error);
		return null;
	}
});

// COMENTADO TEMPORARIAMENTE - depende do Better Auth
// export const getActiveOrganization = cache(async (slug: string) => {
//   try {
//     const activeOrganization = await auth.api.getFullOrganization({
//       query: {
//         organizationSlug: slug,
//       },
//       headers: await headers(),
//     });

//     return activeOrganization;
//   } catch {
//     return null;
//   }
// });

// COMENTADO TEMPORARIAMENTE - depende do Better Auth
// export const getOrganizationList = cache(async () => {
//   try {
//     const organizationList = await auth.api.listOrganizations({
//       headers: await headers(),
//     });

//     return organizationList;
//   } catch {
//     return [];
//   }
// });

// COMENTADO TEMPORARIAMENTE - depende do Better Auth
// export const getUserAccounts = cache(async () => {
//   try {
//     const userAccounts = await auth.api.listUserAccounts({
//       headers: await headers(),
//     });

//     return userAccounts;
//   } catch {
//     return [];
//   }
// });

// COMENTADO TEMPORARIAMENTE - depende do Better Auth
// export const getUserPasskeys = cache(async () => {
//   try {
//     const userPasskeys = await auth.api.listPasskeys({
//       headers: await headers(),
//     });

//     return userPasskeys;
//   } catch {
//     return [];
//   }
// });

export const getInvitation = cache(async (id: string) => {
	try {
		return await getInvitationById(id);
	} catch {
		return null;
	}
});

export const getActiveOrganization = cache(async () => {
	// Retorna null por enquanto - você pode implementar depois
	console.log("⚠️ getActiveOrganization chamada (retornando null)");
	return null;
});

export const getOrganizationList = cache(async () => {
	// Retorna array vazio por enquanto
	return [];
});
