"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@ui/components/alert";
import { Button } from "@ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@ui/components/form";
import { Input } from "@ui/components/input";
import { AlertTriangleIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase/client";

const formSchema = z.object({
	email: z.string().email("Email inválido"),
	password: z.string().min(1, "Senha é obrigatória"),
});

type FormValues = z.infer<typeof formSchema>;

export function LoginForm() {
	const router = useRouter();
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const onSubmit = async (values: FormValues) => {
		setLoading(true);
		setError(null);

		console.log("🔐 Tentando login com:", values.email);

		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: values.email,
				password: values.password,
			});

			console.log("✅ Resposta do login:", {
				hasSession: !!data?.session,
				error: error?.message,
			});

			if (error) {
				setError(error.message);
				return;
			}

			if (data.session) {
				console.group("🎯 LOGIN BEM-SUCEDIDO");
				console.log("Session criada:", {
					user: data.session.user.email,
					accessToken: data.session.access_token ? "***" : "none",
					expiresAt: data.session.expires_at
						? new Date(data.session.expires_at * 1000).toISOString()
						: "N/A",
				});

				// DEBUG ESPECÍFICO - Verificar se cookies foram salvos
				console.log("🍪 Todos os cookies:", document.cookie);
				console.log("🔍 Cookies do Supabase:");
				console.log(
					"  - sb-access-token:",
					!!document.cookie.match(/sb-access-token/),
				);
				console.log(
					"  - sb-refresh-token:",
					!!document.cookie.match(/sb-refresh-token/),
				);
				console.log(
					"  - sb-provider-token:",
					!!document.cookie.match(/sb-provider-token/),
				);

				console.log("📤 Redirecionando para /app/dashboard");
				console.groupEnd();

				// Pequeno delay para garantir que cookies são salvos
				setTimeout(() => {
					router.push("/app/dashboard");
					router.refresh();
				}, 100);
			}
		} catch (err: any) {
			console.log("❌ Erro no login:", err);
			setError(err.message || "Erro ao fazer login");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<h1 className="font-bold text-xl md:text-2xl mb-6">Login</h1>

			<Form {...form}>
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="space-y-4"
				>
					{error && (
						<Alert variant="error">
							{" "}
							<AlertTriangleIcon className="h-4 w-4" />
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					<FormField
						control={form.control}
						name="email"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Email</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="email"
										autoComplete="email"
										placeholder="seu@email.com"
									/>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="password"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Senha</FormLabel>
								<FormControl>
									<div className="relative">
										<Input
											{...field}
											type={
												showPassword
													? "text"
													: "password"
											}
											autoComplete="current-password"
											placeholder="Sua senha"
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() =>
												setShowPassword(!showPassword)
											}
											className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
										>
											{showPassword ? (
												<EyeOffIcon className="h-4 w-4" />
											) : (
												<EyeIcon className="h-4 w-4" />
											)}
										</button>
									</div>
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className="flex justify-between items-center">
						<Link
							href="/auth/forgot-password"
							className="text-sm text-blue-600 hover:underline"
						>
							Esqueceu a senha?
						</Link>
					</div>

					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Entrando..." : "Entrar"}
					</Button>

					<div className="text-center text-sm">
						<span className="text-gray-600">
							Não tem uma conta?{" "}
						</span>
						<Link
							href="/auth/signup"
							className="text-blue-600 hover:underline"
						>
							Cadastre-se
						</Link>
					</div>
				</form>
			</Form>
		</div>
	);
}
