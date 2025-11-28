import { config } from "@repo/config";
import { SessionProvider } from "@saas/auth/components/SessionProvider";
import { sessionQueryKey } from "@saas/auth/lib/api";
import { getSession } from "@saas/auth/lib/server";
import { ActiveOrganizationProvider } from "@saas/organizations/components/ActiveOrganizationProvider";
import { ConfirmationAlertProvider } from "@saas/shared/components/ConfirmationAlertProvider";
import { Document } from "@shared/components/Document";
import { orpc } from "@shared/lib/orpc-query-utils";
import { getServerQueryClient } from "@shared/lib/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { redirect } from "next/navigation";
import type { PropsWithChildren } from "react";

export default async function SaaSLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();
  const messages = await getMessages();
  
  console.log("🔍 SaaS Layout - verificando sessão...");
  const session = await getSession();
  console.log("🔍 SaaS Layout - sessão:", session ? "EXISTE" : "NÃO EXISTE");
  
  if (!session) {
	console.log("❌ SaaS Layout - REDIRECIONANDO para login");
    redirect("/auth/login");
  }

  const queryClient = getServerQueryClient();

  await queryClient.prefetchQuery({
    queryKey: sessionQueryKey,
    queryFn: () => session,
  });

  // COMENTADO TEMPORARIAMENTE - getOrganizationList pode não funcionar ainda
  // if (config.organizations.enable) {
  //   await queryClient.prefetchQuery({
  //     queryKey: organizationListQueryKey,
  //     queryFn: getOrganizationList,
  //   });
  // }

  if (config.users.enableBilling) {
    await queryClient.prefetchQuery(
      orpc.payments.listPurchases.queryOptions({
        input: {},
      }),
    );
  }

  return (
  <NextIntlClientProvider messages={messages}>
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SessionProvider>
        <ActiveOrganizationProvider>
          <ConfirmationAlertProvider>
            {children}
          </ConfirmationAlertProvider>
        </ActiveOrganizationProvider>
      </SessionProvider>
    </HydrationBoundary>
  </NextIntlClientProvider>
);
}