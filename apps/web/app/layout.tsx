// apps/web/app/layout.tsx - MELHOR SOLUÇÃO
import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";
import { config } from "@repo/config";
import { Document } from "@shared/components/Document";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = await getLocale();
	
	return (
		<Document locale={locale}>
			{children}
		</Document>
	);
}