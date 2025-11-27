import { redirect } from "next/navigation";
import { createServerClient } from "../../../lib/supabase/server";
import { LoginForm } from "../../../modules/saas/auth/components/LoginForm";

export default async function LoginPage() {
	const supabase = createServerClient();

	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (session) {
		redirect("/dashboard");
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div className="bg-white p-8 rounded-lg shadow-md">
					<LoginForm />
				</div>
			</div>
		</div>
	);
}
