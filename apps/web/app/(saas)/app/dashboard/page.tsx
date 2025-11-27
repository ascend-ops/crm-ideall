"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { supabase } from "../../../../lib/supabase/client";

interface Cliente {
	status: string;
	name: string;
	email: string;
}

interface User {
	id: string;
	email: string;
}

const STATUS_ORDER = [
	"aprovado",
	"em análise",
	"aguardando documentos",
	"reprovado",
	"fidelizado",
];
const STATUS_COLORS = {
	aprovado: "#10b981",
	"em análise": "#f59e0b",
	"aguardando documentos": "#6366f1",
	reprovado: "#ef4444",
	fidelizado: "#8b5cf6",
};

export default function DashboardPage() {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		console.log("🍪 Cookies disponíveis:", document.cookie);
		console.log("🔍 localStorage:", {
			supabaseAuth: localStorage.getItem("supabase.auth.token"),
			hasAccessToken: !!document.cookie.match(/sb-access-token/),
			hasRefreshToken: !!document.cookie.match(/sb-refresh-token/),
		});
	}, []);

	useEffect(() => {
		console.log("🚀 Dashboard montado - iniciando checkAuth");
		checkAuth();
	}, []);

	const checkAuth = async () => {
		console.group("🔐 CHECK AUTH - DASHBOARD");
		try {
			console.log("1. Chamando supabase.auth.getSession()...");

			const {
				data: { session },
				error,
			} = await supabase.auth.getSession();

			console.log("2. Resposta da sessão:", {
				session: !!session,
				error: error?.message,
				user: session?.user?.email,
				accessToken: session?.access_token ? "***" : "none",
				expiresAt: session?.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: "undefined",
			});

			if (error) {
				console.error("❌ Erro ao verificar sessão:", error);
				console.log("📤 Redirecionando para /auth/login devido a erro");
				router.push("/auth/login");
				return;
			}

			if (!session) {
				console.log("❌ SEM SESSÃO - Motivos possíveis:");
				console.log("   - Cookies não foram salvos");
				console.log("   - Sessão expirou instantaneamente");
				console.log("   - Middleware bloqueou");
				console.log("   - Problema de CORS/cookies");
				console.log("📤 Redirecionando para /auth/login");
				router.push("/auth/login");
				return;
			}

			console.log("✅ SESSÃO VÁLIDA ENCONTRADA");
			console.log("   User:", session.user.email);
			console.log(
				"   Expires at:",
				session.expires_at
					? new Date(session.expires_at * 1000).toISOString()
					: "N/A",
			);

			setUser(session.user as User);
			await loadClientes();
		} catch (error) {
			console.error("💥 Erro inesperado no checkAuth:", error);
			console.log(
				"📤 Redirecionando para /auth/login devido a erro inesperado",
			);
			router.push("/auth/login");
		} finally {
			setLoading(false);
			console.groupEnd();
		}
	};

	const loadClientes = async () => {
		try {
			console.log("📊 Carregando clientes...");
			const { data, error } = await supabase
				.from("clientes")
				.select("status, name, email");

			if (error) {
				console.error("❌ Erro ao carregar clientes:", error);
				setClientes([]);
				return;
			}

			console.log(`✅ ${data?.length || 0} clientes carregados`);
			setClientes(data || []);
		} catch (err) {
			console.error("💥 Erro inesperado ao carregar clientes:", err);
			setClientes([]);
		}
	};

	useEffect(() => {
		console.log("🔄 Estado atualizado:", {
			loading,
			user: user?.email,
			clientesCount: clientes.length,
		});
	}, [loading, user, clientes]);

	const chartData = STATUS_ORDER.map((status) => {
		const count = clientes.filter(
			(cliente: Cliente) => cliente.status === status,
		).length;
		return {
			status: status.charAt(0).toUpperCase() + status.slice(1),
			quantidade: count,
			fill:
				STATUS_COLORS[status as keyof typeof STATUS_COLORS] ||
				"#6b7280",
		};
	});

	if (loading) {
		console.log("⏳ Renderizando estado de loading...");
		return (
			<div className="p-6">
				<h1 className="text-2xl font-bold">Carregando...</h1>
			</div>
		);
	}

	if (!user) {
		console.log("👤 Renderizando null (sem user)");
		return null;
	}

	console.log("🎨 Renderizando dashboard completo");
	return (
		<div className="p-6 space-y-6">
			<h1 className="text-3xl font-bold text-gray-800">
				Dashboard de Clientes
			</h1>

			{/* Info do usuário */}
			<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
				<h2 className="text-lg font-semibold text-blue-800">
					👋 Olá, {user.email}
				</h2>
				<p className="text-blue-600">
					Total de clientes: <strong>{clientes.length}</strong>
				</p>
			</div>

			{/* Gráfico de Barras */}
			<div className="bg-white p-6 rounded-lg shadow border">
				<h2 className="text-xl font-semibold mb-6 text-gray-800">
					Distribuição por Status
				</h2>

				<ResponsiveContainer width="100%" height={400}>
					<BarChart
						data={chartData}
						margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis
							dataKey="status"
							angle={-45}
							textAnchor="end"
							height={80}
							tick={{ fontSize: 12 }}
						/>
						<YAxis />
						<Tooltip
							formatter={(value: unknown) => [
								`${value} clientes`,
								"Quantidade",
							]}
							labelFormatter={(label: string) =>
								`Status: ${label}`
							}
						/>
						<Legend />
						<Bar
							dataKey="quantidade"
							name="Quantidade de Clientes"
							fill="#8884d8"
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>

			{/* Cards de Resumo */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
				{chartData.map((item) => (
					<div
						key={item.status}
						className="bg-white p-4 rounded-lg shadow border text-center"
						style={{ borderLeft: `4px solid ${item.fill}` }}
					>
						<h3 className="font-medium text-gray-700 text-sm mb-2">
							{item.status}
						</h3>
						<p className="text-2xl font-bold text-gray-900">
							{item.quantidade}
						</p>
					</div>
				))}
			</div>

			{/* Tabela de Clientes */}
			<div className="bg-white p-6 rounded-lg shadow border">
				<h2 className="text-xl font-semibold mb-4 text-gray-800">
					Lista de Clientes
				</h2>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead>
							<tr>
								<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Nome
								</th>
								<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Email
								</th>
								<th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
									Status
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200">
							{clientes.map((cliente: Cliente, index: number) => (
								<tr key={index}>
									<td className="px-4 py-2 text-sm text-gray-900">
										{cliente.name}
									</td>
									<td className="px-4 py-2 text-sm text-gray-600">
										{cliente.email}
									</td>
									<td className="px-4 py-2">
										<span
											className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize"
											style={{
												backgroundColor: `${STATUS_COLORS[cliente.status as keyof typeof STATUS_COLORS]}20`,
												color: STATUS_COLORS[
													cliente.status as keyof typeof STATUS_COLORS
												],
											}}
										>
											{cliente.status}
										</span>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
