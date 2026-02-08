import { DM_Sans, Instrument_Serif } from "next/font/google";
import { redirect } from "next/navigation";
import { createServerClient } from "../../../lib/supabase/server";
import { LoginForm } from "../../../modules/saas/auth/components/LoginForm";

const dmSans = DM_Sans({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-dm-sans",
});

const instrumentSerif = Instrument_Serif({
	subsets: ["latin"],
	weight: "400",
	style: ["normal", "italic"],
	variable: "--font-instrument-serif",
});

export default async function LoginPage() {
	const supabase = await createServerClient();

	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (session) {
		redirect("/app/dashboard");
	}

	return (
		<div className={`${dmSans.variable} ${instrumentSerif.variable}`}>
			<LoginForm />
		</div>
	);
}
