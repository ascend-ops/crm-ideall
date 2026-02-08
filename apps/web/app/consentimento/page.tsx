"use client";

import { DM_Sans } from "next/font/google";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const dmSans = DM_Sans({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-dm-sans",
});

function ConsentimentoContent() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	const [estado, setEstado] = useState<"loading" | "invalido" | "expirado" | "pendente" | "aceite" | "confirmado" | "recusado">("loading");
	const [clienteNome, setClienteNome] = useState("");
	const [aceitoEm, setAceitoEm] = useState<string | null>(null);
	const [processando, setProcessando] = useState(false);
	const [erro, setErro] = useState<string | null>(null);

	const verificarToken = useCallback(async () => {
		if (!token) {
			setEstado("invalido");
			return;
		}

		try {
			const res = await fetch(`/api/consentimento/verificar?token=${token}`);
			if (!res.ok) {
				setEstado("invalido");
				return;
			}

			const data = await res.json();
			setClienteNome(data.clienteNome || "");

			if (data.status === "aceite") {
				setEstado("aceite");
				setAceitoEm(data.aceitoEm);
			} else if (data.status === "expirado" || data.expirado) {
				setEstado("expirado");
			} else if (data.status === "pendente") {
				setEstado("pendente");
			} else {
				setEstado("invalido");
			}
		} catch {
			setEstado("invalido");
		}
	}, [token]);

	useEffect(() => {
		verificarToken();
	}, [verificarToken]);

	const handleAceitar = async () => {
		setProcessando(true);
		setErro(null);

		try {
			const res = await fetch("/api/consentimento/aceitar", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});

			if (!res.ok) {
				const data = await res.json();
				setErro(data.error || "Erro ao processar consentimento");
				return;
			}

			setEstado("confirmado");
		} catch {
			setErro("Erro de ligação. Tente novamente.");
		} finally {
			setProcessando(false);
		}
	};

	const handleRecusar = () => {
		setEstado("recusado");
	};

	return (
		<div className={`${dmSans.variable} fixed inset-0 flex items-center justify-center bg-[#f8fafc] font-[family-name:var(--font-dm-sans)]`}>
			<div className="w-full max-w-[560px] mx-4">
				{/* Header */}
				<div className="text-center mb-8">
					<div className="inline-flex items-center gap-2 rounded-full border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-semibold text-[#0a1628]">
						CRM Ideall
					</div>
				</div>

				<div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8">
					{/* Loading */}
					{estado === "loading" && (
						<div className="flex flex-col items-center py-12">
							<div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0a1628] border-t-transparent" />
							<p className="mt-4 text-sm text-gray-500">A verificar...</p>
						</div>
					)}

					{/* Token inválido */}
					{estado === "invalido" && (
						<div className="text-center py-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
								<span className="text-2xl">!</span>
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h2>
							<p className="text-gray-500">
								Este link de consentimento não é válido. Contacte o seu gestor para obter um novo link.
							</p>
						</div>
					)}

					{/* Token expirado */}
					{estado === "expirado" && (
						<div className="text-center py-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
								<span className="text-2xl">&#9200;</span>
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Link expirado</h2>
							<p className="text-gray-500">
								Este link de consentimento expirou. Contacte o seu gestor para obter um novo link.
							</p>
						</div>
					)}

					{/* Já aceite */}
					{estado === "aceite" && (
						<div className="text-center py-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
								<span className="text-2xl text-green-600">&#10003;</span>
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Consentimento já registado</h2>
							<p className="text-gray-500">
								{clienteNome && `${clienteNome}, o`}
								{!clienteNome && "O"} seu consentimento foi registado
								{aceitoEm && ` em ${new Date(aceitoEm).toLocaleDateString("pt-PT")}`}.
							</p>
						</div>
					)}

					{/* Confirmação após aceitar */}
					{estado === "confirmado" && (
						<div className="text-center py-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
								<span className="text-2xl text-green-600">&#10003;</span>
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Consentimento registado com sucesso</h2>
							<p className="text-gray-500">
								Obrigado{clienteNome ? `, ${clienteNome}` : ""}. O seu consentimento foi registado. Pode fechar esta página.
							</p>
						</div>
					)}

					{/* Recusado */}
					{estado === "recusado" && (
						<div className="text-center py-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
								<span className="text-2xl text-gray-500">&#10005;</span>
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Consentimento não dado</h2>
							<p className="text-gray-500">
								Optou por não dar o seu consentimento. Se mudar de ideias, pode utilizar o mesmo link enquanto estiver válido.
							</p>
							<button
								type="button"
								onClick={() => setEstado("pendente")}
								className="mt-4 text-sm font-semibold text-blue-500 hover:text-[#0f2035] transition-colors"
							>
								Voltar ao formulário
							</button>
						</div>
					)}

					{/* Formulário de consentimento */}
					{estado === "pendente" && (
						<div>
							<h2 className="text-xl font-bold text-gray-900 mb-1">
								Consentimento para Tratamento de Dados
							</h2>
							{clienteNome && (
								<p className="text-sm text-gray-500 mb-6">
									{clienteNome}, leia atentamente o texto abaixo.
								</p>
							)}
							{!clienteNome && (
								<p className="text-sm text-gray-500 mb-6">
									Leia atentamente o texto abaixo.
								</p>
							)}

							<div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-5 mb-6">
								<p className="text-[0.85rem] leading-[1.75] text-gray-700">
									A Ideall recolhe e trata os seus dados pessoais (nome, email, telefone, NIF,
									código postal) para fins de gestão e acompanhamento do seu processo de contratação
									de serviços. Os seus dados serão conservados durante o período da relação contratual
									e pelo prazo legal aplicável. Tem o direito de aceder, rectificar, apagar e opor-se
									ao tratamento dos seus dados, contactando rgpd@ideall.pt.
								</p>
								<p className="text-[0.85rem] leading-[1.75] text-gray-700 mt-3">
									Ao clicar em &lsquo;Aceito&rsquo;, declara que tomou conhecimento e consente o tratamento dos
									seus dados nos termos descritos.
								</p>
								<p className="mt-3 text-xs text-gray-400">Versão v1.0</p>
							</div>

							{erro && (
								<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
									{erro}
								</div>
							)}

							<div className="flex gap-3">
								<button
									type="button"
									onClick={handleAceitar}
									disabled={processando}
									className="flex-1 rounded-[10px] bg-[#0a1628] px-4 py-3 text-[0.95rem] font-semibold text-white transition-all hover:bg-[#0f2035] hover:shadow-[0_6px_20px_rgba(10,22,40,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
								>
									{processando ? (
										<span className="flex items-center justify-center gap-2">
											<span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
											A processar...
										</span>
									) : (
										"Aceito o tratamento dos meus dados"
									)}
								</button>
								<button
									type="button"
									onClick={handleRecusar}
									disabled={processando}
									className="rounded-[10px] bg-white border border-[#e2e8f0] px-6 py-3 text-[0.95rem] font-semibold text-[#334155] transition-all hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
								>
									Não aceito
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="mt-6 text-center">
					<span className="text-[0.72rem] tracking-wide text-gray-400">
						CRM Ideall · Powered by Ascend Ops
					</span>
				</div>
			</div>
		</div>
	);
}

export default function ConsentimentoPage() {
	return (
		<Suspense
			fallback={
				<div className={`${dmSans.variable} fixed inset-0 flex items-center justify-center bg-[#f8fafc] font-[family-name:var(--font-dm-sans)]`}>
					<div className="h-8 w-8 animate-spin rounded-full border-3 border-[#0a1628] border-t-transparent" />
				</div>
			}
		>
			<ConsentimentoContent />
		</Suspense>
	);
}
