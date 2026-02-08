"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase/client";

const formSchema = z.object({
	email: z.string().email("Email inválido"),
	password: z.string().min(1, "Palavra-passe é obrigatória"),
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

		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: values.email,
				password: values.password,
			});

			if (error) {
				setError(error.message);
				return;
			}

			if (data.session) {
				setTimeout(() => {
					router.push("/app/dashboard");
					router.refresh();
				}, 100);
			}
		} catch (err: any) {
			setError(err.message || "Erro ao fazer login");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex w-full overflow-hidden bg-white font-[family-name:var(--font-dm-sans)]">
			{/* ══════════ LEFT PANEL ══════════ */}
			<div className="relative hidden w-[52%] flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0f2035] to-[#152a42] px-[4.5rem] py-16 lg:flex">
				{/* Grid overlay */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						backgroundImage:
							"linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
						backgroundSize: "48px 48px",
					}}
				/>

				{/* Radial glows */}
				<div className="absolute -right-[10%] top-[10%] h-[500px] w-[500px] animate-[breathe_10s_ease-in-out_infinite] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)]" />
				<div className="absolute -left-[5%] bottom-[5%] h-[350px] w-[350px] animate-[breathe_12s_ease-in-out_infinite_3s] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)]" />

				{/* Line accents */}
				<div className="absolute left-1/4 top-0 h-[180px] w-px bg-gradient-to-b from-[rgba(59,130,246,0.3)] to-transparent" />
				<div className="absolute left-[65%] top-0 h-[120px] w-px bg-gradient-to-b from-[rgba(59,130,246,0.3)] to-transparent opacity-50" />
				<div className="absolute bottom-0 right-[20%] h-[140px] w-px bg-gradient-to-t from-[rgba(59,130,246,0.2)] to-transparent" />

				{/* Content */}
				<div className="relative z-10 animate-[slideIn_0.6s_ease-out_0.2s_backwards]">
					<div className="mb-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300 backdrop-blur-sm">
						<span className="h-[7px] w-[7px] animate-[pulse_2.5s_ease-in-out_infinite] rounded-full bg-green-500" />
						Plataforma Activa
					</div>

					<h1 className="animate-[slideIn_0.6s_ease-out_0.35s_backwards] font-[family-name:var(--font-instrument-serif)] text-[3.6rem] font-normal leading-[1.08] text-white">
						Gestão de processos
						<br />
						<em className="text-blue-300">inteligente</em> e
						<br />
						centralizada
					</h1>

					<p className="mt-6 max-w-[400px] animate-[slideIn_0.6s_ease-out_0.5s_backwards] text-[1.05rem] leading-[1.75] text-white/50">
						Controle todos os seus processos, parceiros e equipas
						numa única plataforma. Visibilidade total em cada etapa.
					</p>

					<div className="mb-8 mt-14 h-0.5 w-12 animate-[slideIn_0.6s_ease-out_0.6s_backwards] rounded-full bg-gradient-to-r from-blue-500 to-transparent" />

					<div className="flex animate-[slideIn_0.6s_ease-out_0.7s_backwards] gap-10">
						<div>
							<div className="-tracking-wide text-[1.75rem] font-bold leading-none text-white">
								100%
							</div>
							<div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
								Controlo
							</div>
						</div>
						<div className="relative before:absolute before:-left-5 before:top-1/2 before:h-9 before:w-px before:-translate-y-1/2 before:bg-white/10">
							<div className="-tracking-wide text-[1.75rem] font-bold leading-none text-white">
								Total
							</div>
							<div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
								Acompanhamento
							</div>
						</div>
						<div className="relative before:absolute before:-left-5 before:top-1/2 before:h-9 before:w-px before:-translate-y-1/2 before:bg-white/10">
							<div className="-tracking-wide text-[1.75rem] font-bold leading-none text-white">
								360°
							</div>
							<div className="mt-1 text-xs font-medium uppercase tracking-widest text-white/40">
								Visibilidade
							</div>
						</div>
					</div>
				</div>

				{/* Bottom attribution */}
				<div className="absolute bottom-10 left-[4.5rem] z-10">
					<span className="text-xs tracking-wide text-white/25">
						© 2026 Ascend Ops · Todos os direitos reservados
					</span>
				</div>
			</div>

			{/* ══════════ RIGHT PANEL ══════════ */}
			<div className="relative flex w-full items-center justify-center bg-white p-8 lg:w-[48%] lg:bg-white max-lg:bg-slate-50">
				<div className="w-full max-w-[400px] max-lg:rounded-2xl max-lg:bg-white max-lg:p-8 max-lg:shadow-sm">
					{/* Header */}
					<h2 className="animate-[fadeUp_0.5s_ease-out_0.15s_backwards] text-[1.65rem] font-bold -tracking-wider text-gray-900">
						Bem-vindo de volta
					</h2>
					<p className="mb-8 animate-[fadeUp_0.5s_ease-out_0.2s_backwards] text-[0.92rem] leading-relaxed text-gray-500">
						Insira as suas credenciais para aceder ao painel
					</p>

					{/* Error */}
					{error && (
						<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
							{error}
						</div>
					)}

					{/* Form */}
					<form onSubmit={form.handleSubmit(onSubmit)}>
						{/* Email */}
						<div className="mb-5 animate-[fadeUp_0.5s_ease-out_0.25s_backwards]">
							<label
								htmlFor="login-email"
								className="mb-1.5 block text-[0.82rem] font-semibold text-gray-700"
							>
								Email
							</label>
							<div className="group relative">
								<Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#0a1628]" />
								<input
									id="login-email"
									type="email"
									autoComplete="email"
									placeholder="nome@empresa.pt"
									className="w-full rounded-[10px] border-[1.5px] border-gray-200 bg-white py-3 pl-11 pr-4 text-[0.92rem] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0a1628] focus:shadow-[0_0_0_3px_rgba(10,22,40,0.08)]"
									{...form.register("email")}
								/>
							</div>
							{form.formState.errors.email && (
								<p className="mt-1 text-xs text-red-500">
									{form.formState.errors.email.message}
								</p>
							)}
						</div>

						{/* Password */}
						<div className="mb-5 animate-[fadeUp_0.5s_ease-out_0.3s_backwards]">
							<label
								htmlFor="login-password"
								className="mb-1.5 block text-[0.82rem] font-semibold text-gray-700"
							>
								Palavra-passe
							</label>
							<div className="group relative">
								<Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#0a1628]" />
								<input
									id="login-password"
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									placeholder="••••••••"
									className="w-full rounded-[10px] border-[1.5px] border-gray-200 bg-white py-3 pl-11 pr-12 text-[0.92rem] text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0a1628] focus:shadow-[0_0_0_3px_rgba(10,22,40,0.08)]"
									{...form.register("password")}
								/>
								<button
									type="button"
									onClick={() =>
										setShowPassword(!showPassword)
									}
									className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center rounded-md p-1 text-gray-400 transition-colors hover:text-gray-700"
									aria-label={
										showPassword
											? "Ocultar palavra-passe"
											: "Mostrar palavra-passe"
									}
								>
									{showPassword ? (
										<EyeOff className="h-[17px] w-[17px]" />
									) : (
										<Eye className="h-[17px] w-[17px]" />
									)}
								</button>
							</div>
							{form.formState.errors.password && (
								<p className="mt-1 text-xs text-red-500">
									{form.formState.errors.password.message}
								</p>
							)}
						</div>

						{/* Remember + Forgot */}
						<div className="mb-6 flex animate-[fadeUp_0.5s_ease-out_0.35s_backwards] items-center justify-between">
							<label className="flex cursor-pointer items-center gap-2">
								<input
									type="checkbox"
									className="h-[15px] w-[15px] cursor-pointer rounded accent-[#0a1628]"
								/>
								<span className="text-[0.82rem] text-gray-500">
									Lembrar-me
								</span>
							</label>
							<button
								type="button"
								className="text-[0.82rem] font-semibold text-blue-500 transition-colors hover:text-[#0f2035]"
							>
								Esqueceu a palavra-passe?
							</button>
						</div>

						{/* Submit */}
						<button
							type="submit"
							disabled={loading}
							className="relative w-full animate-[fadeUp_0.5s_ease-out_0.4s_backwards] overflow-hidden rounded-[10px] bg-[#0a1628] px-4 py-3.5 text-[0.95rem] font-semibold text-white tracking-wide transition-all hover:-translate-y-px hover:bg-[#0f2035] hover:shadow-[0_6px_20px_rgba(10,22,40,0.25)] active:translate-y-0 active:shadow-[0_2px_8px_rgba(10,22,40,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{loading ? (
								<span className="flex items-center justify-center gap-2">
									<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
									A entrar...
								</span>
							) : (
								"Entrar"
							)}
						</button>
					</form>

					{/* Footer */}
					<div className="mt-7 animate-[fadeUp_0.5s_ease-out_0.45s_backwards] text-center">
						<p className="text-[0.82rem] text-gray-500">
							Ainda não tem conta?{" "}
							<span className="cursor-pointer font-semibold text-blue-500 transition-colors hover:text-[#0f2035]">
								Contacte o administrador
							</span>
						</p>
					</div>
				</div>

				{/* Copyright */}
				<div className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.72rem] tracking-wide text-gray-400">
					CRM Ideall · Powered by Ascend Ops
				</div>
			</div>
		</div>
	);
}
