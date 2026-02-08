"use client";

import {
	AlertTriangle,
	ChevronRight,
	LayoutDashboard,
	LogOut,
	Menu,
	TrendingUp,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
	createdAt: string;
	dataFimContrato: string | null;
	profileId: string | null;
	tenantId: string | null;
}

interface User {
	id: string;
	email: string;
	user_metadata?: { role?: string };
}

interface Profile {
	id: string;
	name: string;
	email: string;
	role: string;
}

interface GestorCardData {
	id: string;
	name: string;
	email: string;
	totalClientes: number;
	statusCount: {
		aprovado: number;
		"em análise": number;
		"aguarda documentos": number;
		reprovado: number;
		fidelizado: number;
	};
}

interface MonthlyData {
	month: string;
	aprovado: number;
	"em análise": number;
	"aguarda documentos": number;
	reprovado: number;
	fidelizado: number;
}

const STATUS_ORDER = [
	"aprovado",
	"em análise",
	"aguarda documentos",
	"reprovado",
	"fidelizado",
];

const STATUS_COLORS = {
	aprovado: "#16a34a",
	"em análise": "#ca8a04",
	"aguarda documentos": "#3b82f6",
	reprovado: "#dc2626",
	fidelizado: "#9333ea",
};

const STATUS_LABELS: Record<string, string> = {
	aprovado: "Aprovado",
	"em análise": "Análise",
	"aguarda documentos": "Aguarda docs",
	reprovado: "Reprovado",
	fidelizado: "Fidelizado",
};

const MONTHS = [
	"Janeiro",
	"Fevereiro",
	"Março",
	"Abril",
	"Maio",
	"Junho",
	"Julho",
	"Agosto",
	"Setembro",
	"Outubro",
	"Novembro",
	"Dezembro",
];

export default function DashboardPage() {
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [gestoresCards, setGestoresCards] = useState<GestorCardData[]>([]);
	const [clientesSemConsent, setClientesSemConsent] = useState<{id: string; name: string; email: string; createdAt: string}[]>([]);
	const [loading, setLoading] = useState(true);

	// Estados para filtro de mês/ano
	const [selectedMonth, setSelectedMonth] = useState<string>("all");
	const [selectedYear, setSelectedYear] = useState<string>("all");
	const [filteredChartData, setFilteredChartData] = useState<MonthlyData[]>(
		[],
	);
	const [showAllData, setShowAllData] = useState<boolean>(false);

	useEffect(() => {
		checkAuth();
	}, []);

	const checkAuth = async () => {
		try {
			const {
				data: { session },
				error,
			} = await supabase.auth.getSession();

			if (error || !session) {
				router.push("/auth/login");
				return;
			}

			setUser(session.user as User);

			// Always use profiles table as source of truth for role
			const { data: profileData } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", session.user.id)
				.single();

			if (profileData) {
				setProfile(profileData);

				await loadClientes(profileData.role);

				if (profileData.role === "tenant") {
					await loadGestoresCards(profileData.id);
				}

				// Carregar clientes sem consentimento RGPD (tenant e gestor)
				if (profileData.role === "tenant" || profileData.role === "gestor") {
					let rgpdQuery = supabase
						.from("clientes")
						.select("id, name, email, createdAt")
						.eq("consentimentoRGPD", false)
						.order("createdAt", { ascending: false })
						.limit(20);

					if (profileData.role === "tenant") {
						rgpdQuery = rgpdQuery.eq("tenantId", profileData.id);
					} else if (profileData.role === "gestor") {
						rgpdQuery = rgpdQuery.eq("profileId", profileData.id);
					}

					const { data: semConsent } = await rgpdQuery;
					setClientesSemConsent(semConsent || []);
				}
			} else {
				router.push("/auth/login");
			}
		} catch (_error) {
			router.push("/auth/login");
		} finally {
			setLoading(false);
		}
	};

	const loadClientes = async (userRole?: string) => {
		try {
			const { data, error } = await supabase
				.from("clientes")
				.select("status, name, email, createdAt, dataFimContrato, profileId, tenantId");

			if (error) {
				setClientes([]);
				return;
			}

			setClientes(data || []);
		} catch (_err) {
			setClientes([]);
		}
	};

	const loadGestoresCards = async (_tenantId: string) => {
		try {
			// Query 1: todos os gestores
			const { data: teamMembers, error } = await supabase
				.from("profiles")
				.select('id, name, email, role, "tenantId"')
				.eq("role", "gestor")
				.order("name", { ascending: true });

			if (error || !teamMembers?.length) {
				setGestoresCards([]);
				return;
			}

			const gestorIds = teamMembers.map((g) => g.id);

			// Query 2: todos os clientes desses gestores (single query)
			const { data: todosClientes } = await supabase
				.from("clientes")
				.select("status, profileId")
				.in("profileId", gestorIds);

			// Agrupar clientes por profileId em memória
			const clientesPorGestor = new Map<string, { status: string }[]>();
			(todosClientes || []).forEach((c) => {
				if (!c.profileId) return;
				const list = clientesPorGestor.get(c.profileId) || [];
				list.push(c);
				clientesPorGestor.set(c.profileId, list);
			});

			const gestoresComDados = teamMembers.map((gestor) => {
				const clientesGestor = clientesPorGestor.get(gestor.id) || [];

				const statusCount = {
					aprovado: 0,
					"em análise": 0,
					"aguarda documentos": 0,
					reprovado: 0,
					fidelizado: 0,
				};

				clientesGestor.forEach((cliente) => {
					const status = cliente.status as keyof typeof statusCount;
					if (status in statusCount) {
						statusCount[status]++;
					}
				});

				return {
					id: gestor.id,
					name: gestor.name,
					email: gestor.email,
					totalClientes: clientesGestor.length,
					statusCount,
				};
			});

			setGestoresCards(gestoresComDados);
		} catch (err) {
			setGestoresCards([]);
		}
	};

	// Processar dados para o gráfico com filtro de mês/ano
	useEffect(() => {
		if (clientes.length === 0) {
			setFilteredChartData([]);
			return;
		}

		let chartData: MonthlyData[] = [];

		if (showAllData) {
			// Modo "Todos" - mostrar todos os dados
			const allData: MonthlyData = {
				month: "Todos os meses",
				aprovado: 0,
				"em análise": 0,
				"aguarda documentos": 0,
				reprovado: 0,
				fidelizado: 0,
			};

			clientes.forEach((cliente) => {
				const status = cliente.status as keyof MonthlyData;
				if (status in allData) {
					allData[status]++;
				}
			});

			chartData = [allData];
		} else if (selectedMonth !== "all" && selectedYear !== "all") {
			// Modo filtrado por mês/ano específico
			const monthNum = Number.parseInt(selectedMonth);
			const yearNum = Number.parseInt(selectedYear);

			// Filtrar clientes pelo mês e ano selecionados
			const filteredClientes = clientes.filter((cliente) => {
				const clienteDate = new Date(cliente.createdAt);
				return (
					clienteDate.getMonth() === monthNum &&
					clienteDate.getFullYear() === yearNum
				);
			});

			// Criar estrutura de dados mensal
			const monthlyData: MonthlyData = {
				month: MONTHS[monthNum],
				aprovado: 0,
				"em análise": 0,
				"aguarda documentos": 0,
				reprovado: 0,
				fidelizado: 0,
			};

			// Contar clientes por status
			filteredClientes.forEach((cliente) => {
				const status = cliente.status as keyof MonthlyData;
				if (status in monthlyData) {
					monthlyData[status]++;
				}
			});

			chartData = [monthlyData];
		} else {
			// Se algum dos filtros estiver como "all", mostrar todos os dados
			const allData: MonthlyData = {
				month: "Todos",
				aprovado: 0,
				"em análise": 0,
				"aguarda documentos": 0,
				reprovado: 0,
				fidelizado: 0,
			};

			clientes.forEach((cliente) => {
				const status = cliente.status as keyof MonthlyData;
				if (status in allData) {
					allData[status]++;
				}
			});

			chartData = [allData];
		}

		setFilteredChartData(chartData);
	}, [clientes, selectedMonth, selectedYear, showAllData]);

	// Gerar anos disponíveis (últimos 5 anos + ano atual)
	const currentYear = new Date().getFullYear();
	const availableYears = Array.from(
		{ length: 6 },
		(_, i) => currentYear - 5 + i,
	).filter((year) => year <= currentYear);

	const handleLogout = async () => {
		await supabase.auth.signOut();
		setProfile(null);
		setUser(null);
		router.push("/auth/login");
	};

	const handleNavigation = (path: string) => {
		router.push(path);
	};

	const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			action();
		}
	};

	const handleOverlayClick = (_e: React.MouseEvent) => {
		setSidebarOpen(false);
	};

	const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
			e.preventDefault();
			setSidebarOpen(false);
		}
	};

	const toggleShowAllData = () => {
		setShowAllData(!showAllData);
		// Resetar filtros quando ativar "Todos"
		if (!showAllData) {
			setSelectedMonth("all");
			setSelectedYear("all");
		}
	};

	if (loading) {
		return (
			<div className="p-6">
				<h1 className="text-2xl font-bold">A carregar...</h1>
			</div>
		);
	}

	if (!user || !profile) {
		return null;
	}

	// Computar alertas de fidelização
	const alertasFidelizacao = (() => {
		if (profile?.role === "parceiro") return [];

		const hoje = new Date();
		hoje.setHours(0, 0, 0, 0);

		return clientes
			.filter((c) => {
				if (!c.dataFimContrato) return false;
				// Gestor: apenas os seus clientes
				if (profile?.role === "gestor" && c.profileId !== profile.id) return false;
				const fim = new Date(c.dataFimContrato);
				const dias = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
				return dias <= 30; // inclui expirados (negativos) e a expirar
			})
			.map((c) => {
				const fim = new Date(c.dataFimContrato!);
				const dias = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
				return { ...c, diasRestantes: dias, dataFim: fim };
			})
			.sort((a, b) => a.diasRestantes - b.diasRestantes);
	})();

	const handleCopiarLinkRGPD = async (clienteId: string) => {
		try {
			const res = await fetch("/api/consentimento", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ clienteId }),
			});

			if (!res.ok) {
				const data = await res.json();
				toast.error(data.error || "Erro ao gerar link RGPD");
				return;
			}

			const { link } = await res.json();
			try {
				await navigator.clipboard.writeText(link);
				toast.success("Link RGPD copiado para a área de transferência");
			} catch {
				prompt("Copie o link RGPD:", link);
			}
		} catch (err: any) {
			console.error("[RGPD] Erro cliente:", err);
			toast.error(err?.message || "Erro ao gerar link RGPD");
		}
	};

	const getAlertaClasses = (dias: number) => {
		if (dias < 0) return { bg: "bg-red-100", text: "text-red-900", badge: "bg-red-200 text-red-900" };
		if (dias <= 7) return { bg: "bg-red-50", text: "text-red-700", badge: "bg-red-100 text-red-700" };
		if (dias <= 15) return { bg: "bg-orange-50", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" };
		return { bg: "bg-yellow-50", text: "text-yellow-700", badge: "bg-yellow-100 text-yellow-700" };
	};

	const getAlertaLabel = (dias: number) => {
		if (dias < 0) return `Expirado há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}`;
		if (dias === 0) return "Expira hoje";
		return `${dias} dia${dias !== 1 ? "s" : ""}`;
	};

	// Criar dados filtrados para o gráfico
	const filteredChartDataForGraph = STATUS_ORDER.map((status) => {
		const monthlyData = filteredChartData[0];
		const count = monthlyData
			? monthlyData[status as keyof MonthlyData]
			: 0;
		return {
			status: STATUS_LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1),
			quantidade: count,
			fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
		};
	});

	return (
		<div className="flex min-h-screen bg-gray-50">
			{/* Sidebar */}
			<nav
				className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
					expanded ? "w-64" : "w-16"
				} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
				aria-label="Navegação principal"
			>
				<div className="flex flex-col h-full">
					{/* BOTÃO DE EXPANDIR/RETRAIR (DESKTOP) */}
					<div className="p-4 border-b border-gray-200 flex items-center">
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="p-2 rounded-md hover:bg-gray-100"
						>
							<Menu className="w-5 h-5" />
						</button>

						{expanded && (
							<h2 className="ml-3 font-bold text-lg text-gray-800 truncate">
								Menu Principal
							</h2>
						)}
					</div>

					{/* Menu items */}
					<div className="flex-1 p-4 space-y-2">
						{/* Dashboard */}
						<button
							type="button"
							onClick={() => handleNavigation("/app/dashboard")}
							onKeyDown={(e) =>
								handleKeyDown(e, () =>
									handleNavigation("/app/dashboard"),
								)
							}
							className="flex items-center w-full p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors group"
							aria-label="Ir para o Dashboard"
						>
							<LayoutDashboard className="w-5 h-5 shrink-0" />
							{expanded && (
								<span className="ml-3 font-medium truncate">
									Dashboard
								</span>
							)}
							{expanded && (
								<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							)}
						</button>

						{/* Clientes */}
						<button
							type="button"
							onClick={() => handleNavigation("/app/clientes")}
							onKeyDown={(e) =>
								handleKeyDown(e, () =>
									handleNavigation("/app/clientes"),
								)
							}
							className="flex items-center w-full p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors group"
							aria-label="Ir para a página de Clientes"
						>
							<Users className="w-5 h-5 shrink-0" />
							{expanded && (
								<span className="ml-3 font-medium truncate">
									Clientes
								</span>
							)}
							{expanded && (
								<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							)}
						</button>

						{/* Gráfico de Aprovados */}
						<button
							type="button"
							onClick={() => handleNavigation("/app/aprovados")}
							onKeyDown={(e) =>
								handleKeyDown(e, () =>
									handleNavigation("/app/aprovados"),
								)
							}
							className="flex items-center w-full p-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors group"
							aria-label="Ir para o Gráfico de Aprovados"
						>
							<TrendingUp className="w-5 h-5 shrink-0" />
							{expanded && (
								<span className="ml-3 font-medium truncate">
									Aprovados
								</span>
							)}
							{expanded && (
								<ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
							)}
						</button>
					</div>

					{/* User info */}
					<div className="p-4 border-t border-gray-200">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center shrink-0">
								<span className="text-gray-600 text-sm font-semibold">
									{user.email?.charAt(0).toUpperCase() || "U"}
								</span>
							</div>
							{expanded && (
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{user.email}
									</p>
									<p className="text-xs text-gray-500 capitalize truncate">
										{profile.role}
									</p>
								</div>
							)}
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className={`flex items-center w-full mt-3 p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${expanded ? "justify-start gap-2" : "justify-center"}`}
							aria-label="Terminar sessão"
						>
							<LogOut className="w-4 h-4 shrink-0" />
							{expanded && (
								<span className="text-sm font-medium">
									Terminar sessão
								</span>
							)}
						</button>
					</div>
				</div>
			</nav>

			{/* Overlay para mobile */}
			{sidebarOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/50 z-30 md:hidden"
					onClick={handleOverlayClick}
					onKeyDown={handleOverlayKeyDown}
					aria-label="Fechar menu"
				/>
			)}

			{/* Conteúdo principal */}
			<div
				className={`flex-1 transition-all duration-300 ${
					expanded ? "md:ml-64" : "md:ml-16"
				}`}
			>
				{/* Botão de menu para mobile */}
				<div className="md:hidden p-4">
					<button
						type="button"
						onClick={() => setSidebarOpen(true)}
						className="p-2 rounded-md bg-white border shadow-sm"
						aria-label="Abrir menu"
					>
						<Menu className="w-5 h-5" />
					</button>
				</div>

				<div className="p-6 space-y-6">
					<h1 className="text-3xl font-bold text-gray-800">
						Dashboard de Clientes
						{profile?.role && (
							<span className="text-sm ml-2 text-gray-500">
								({profile.role})
							</span>
						)}
					</h1>

					<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
						<h2 className="text-lg font-semibold text-blue-800">
							Olá, {user.email}
						</h2>
						<p className="text-blue-600">
							Total de clientes:{" "}
							<strong>{clientes.length}</strong>
						</p>
						{profile?.role && (
							<p className="text-blue-600">
								Role: <strong>{profile.role}</strong>
							</p>
						)}
						{profile?.role === "tenant" && (
							<p className="text-blue-600 mt-2">
								Gestores:{" "}
								<strong>{gestoresCards.length}</strong>
							</p>
						)}
					</div>

					{/* Alertas de Fidelização */}
					{profile?.role !== "parceiro" && (
						<div className="bg-white p-6 rounded-lg shadow border">
							<div className="flex items-center gap-2 mb-4">
								<AlertTriangle className="w-5 h-5 text-amber-500" />
								<h2 className="text-xl font-semibold text-gray-800">
									Alertas de Fidelização
								</h2>
								{alertasFidelizacao.length > 0 && (
									<span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
										{alertasFidelizacao.length}
									</span>
								)}
							</div>

							{alertasFidelizacao.length === 0 ? (
								<div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
									<span className="text-green-600 text-lg">✓</span>
									<p className="text-green-700 font-medium">
										Sem alertas — nenhum contrato a expirar nos próximos 30 dias.
									</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-200">
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Nome</th>
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Data Fim Contrato</th>
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Estado</th>
											</tr>
										</thead>
										<tbody>
											{alertasFidelizacao.map((alerta, idx) => {
												const classes = getAlertaClasses(alerta.diasRestantes);
												return (
													<tr key={`${alerta.email}-${idx}`} className={`border-b border-gray-100 ${classes.bg}`}>
														<td className={`py-2 px-3 font-medium ${classes.text}`}>
															{alerta.name}
														</td>
														<td className={`py-2 px-3 ${classes.text}`}>
															{alerta.dataFim.toLocaleDateString("pt-PT")}
														</td>
														<td className="py-2 px-3">
															<span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${classes.badge}`}>
																{getAlertaLabel(alerta.diasRestantes)}
															</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}

					{/* Consentimentos RGPD Pendentes */}
					{(profile?.role === "tenant" || profile?.role === "gestor") && (
						<div className="bg-white p-6 rounded-lg shadow border">
							<div className="flex items-center gap-2 mb-4">
								<AlertTriangle className="w-5 h-5 text-blue-500" />
								<h2 className="text-xl font-semibold text-gray-800">
									Consentimentos RGPD Pendentes
								</h2>
								{clientesSemConsent.length > 0 && (
									<span className="ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700">
										{clientesSemConsent.length}
									</span>
								)}
							</div>

							{clientesSemConsent.length === 0 ? (
								<div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
									<span className="text-green-600 text-lg">&#10003;</span>
									<p className="text-green-700 font-medium">
										Todos os clientes têm consentimento RGPD.
									</p>
								</div>
							) : (
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b border-gray-200">
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Nome</th>
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Email</th>
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Criado há</th>
												<th className="text-left py-2 px-3 font-semibold text-gray-600">Ação</th>
											</tr>
										</thead>
										<tbody>
											{clientesSemConsent.map((cliente) => {
												const diasCriado = Math.floor(
													(Date.now() - new Date(cliente.createdAt).getTime()) / (1000 * 60 * 60 * 24)
												);
												return (
													<tr key={cliente.id} className="border-b border-gray-100 hover:bg-gray-50">
														<td className="py-2 px-3 font-medium text-gray-800">
															{cliente.name}
														</td>
														<td className="py-2 px-3 text-gray-600">
															{cliente.email || "-"}
														</td>
														<td className="py-2 px-3 text-gray-600">
															{diasCriado === 0 ? "Hoje" : `${diasCriado} dia${diasCriado !== 1 ? "s" : ""}`}
														</td>
														<td className="py-2 px-3">
															<button
																type="button"
																onClick={() => handleCopiarLinkRGPD(cliente.id)}
																className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#e2e8f0] text-[#334155] rounded-lg hover:bg-[#f8fafc] hover:border-[#cbd5e1] transition-colors"
															>
																Copiar link
															</button>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}

					{/* Gráfico */}
					<div className="bg-white p-6 rounded-lg shadow border">
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
							<h2 className="text-xl font-semibold text-gray-800">
								Distribuição por Status
								{profile?.role === "gestor" && (
									<span className="text-sm font-normal ml-2 text-gray-500">
										(Os seus clientes)
									</span>
								)}
								{profile?.role === "tenant" && (
									<span className="text-sm font-normal ml-2 text-gray-500">
										(Todos os clientes da empresa)
									</span>
								)}
							</h2>

							{/* Container para botão "Mostrar Todos" e filtros */}
							<div className="flex flex-col md:flex-row items-start md:items-center gap-4">
								{/* Botão para mostrar todos os dados */}
								<div className="w-full md:w-auto">
									<div className="text-sm font-medium text-gray-700 mb-1">
										Vista
									</div>
									<button
										type="button"
										onClick={toggleShowAllData}
										className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 w-full md:w-auto justify-center ${
											showAllData
												? "bg-green-600 text-white hover:bg-green-700"
												: "bg-gray-200 text-gray-700 hover:bg-gray-300"
										}`}
									>
										<span className="text-sm font-medium">
											{showAllData
												? "Todos Ativo"
												: "Mostrar Todos"}
										</span>
									</button>
								</div>

								{/* Filtro de Mês/Ano - desabilitado quando "Todos" está ativo */}
								<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
									<div className="w-full sm:w-auto">
										<label
											htmlFor="month-filter"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Mês
										</label>
										<select
											id="month-filter"
											value={selectedMonth}
											onChange={(e) =>
												setSelectedMonth(e.target.value)
											}
											disabled={showAllData}
											className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
												showAllData
													? "bg-gray-100 text-gray-500 cursor-not-allowed"
													: ""
											}`}
										>
											<option value="all">Todos</option>
											{MONTHS.map((month, index) => (
												<option
													key={month}
													value={index}
												>
													{month}
												</option>
											))}
										</select>
									</div>

									<div className="w-full sm:w-auto">
										<label
											htmlFor="year-filter"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Ano
										</label>
										<select
											id="year-filter"
											value={selectedYear}
											onChange={(e) =>
												setSelectedYear(e.target.value)
											}
											disabled={showAllData}
											className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${
												showAllData
													? "bg-gray-100 text-gray-500 cursor-not-allowed"
													: ""
											}`}
										>
											<option value="all">Todos</option>
											{availableYears.map((year) => (
												<option key={year} value={year}>
													{year}
												</option>
											))}
										</select>
									</div>
								</div>
							</div>
						</div>

						<div className="mb-4 text-sm text-gray-600">
							{showAllData ? (
								<p>
									Mostrando <strong>TODOS os dados</strong>{" "}
									(sem filtro de mês/ano)
								</p>
							) : selectedMonth === "all" ||
								selectedYear === "all" ? (
								<p>
									Mostrando <strong>TODOS os dados</strong>{" "}
									(selecione mês e ano para filtrar)
								</p>
							) : (
								<p>
									Mostrando dados para{" "}
									<strong>
										{MONTHS[Number.parseInt(selectedMonth)]}{" "}
										de {selectedYear}
									</strong>
									{filteredChartData.length > 0 && (
										<span className="ml-2">
											• Total no período:{" "}
											<strong>
												{Object.values(
													filteredChartData[0] || {},
												)
													.slice(1)
													.reduce((a, b) => a + b, 0)}
											</strong>{" "}
											clientes
										</span>
									)}
								</p>
							)}
							<p className="mt-1">
								Total geral de clientes:{" "}
								<strong>{clientes.length}</strong>
							</p>
						</div>

						<ResponsiveContainer width="100%" height={400}>
							<BarChart
								data={filteredChartDataForGraph}
								margin={{
									top: 20,
									right: 30,
									left: 20,
									bottom: 5,
								}}
							>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis
									dataKey="status"
									angle={0}
									textAnchor="middle"
									height={40}
									tick={{ fontSize: 12 }}
								/>
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="quantidade" fill="#8884d8" />
							</BarChart>
						</ResponsiveContainer>
					</div>

					{/* Gestores (agora abaixo do gráfico) */}
					{profile?.role === "tenant" && (
						<>
							{gestoresCards.length > 0 ? (
								<div className="bg-white p-6 rounded-lg shadow border">
									<h2 className="text-xl font-semibold mb-6 text-gray-800">
										Gestores da Sua Empresa
										<span className="text-sm font-normal ml-2 text-gray-500">
											({gestoresCards.length} gestores)
										</span>
									</h2>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
										{gestoresCards.map((gestor) => (
											<div
												key={gestor.id}
												className="border rounded-lg p-4 hover:shadow-lg hover:border-[#cbd5e1] transition-all cursor-pointer"
												onClick={() => router.push(`/app/clientes?gestor=${encodeURIComponent(gestor.id)}`)}
											>
												<div className="flex items-start gap-4">
													<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200 shrink-0">
														<span className="text-blue-600 text-xl font-bold">
															{gestor.name
																.charAt(0)
																.toUpperCase()}
														</span>
													</div>

													<div className="flex-1 min-w-0">
														<h3 className="font-bold text-lg text-gray-800 truncate">
															{gestor.name}
														</h3>
														<p className="text-sm text-gray-600 truncate">
															{gestor.email}
														</p>

														<div className="mt-3 p-2 bg-gray-50 rounded">
															<p className="font-semibold text-gray-700">
																Total:{" "}
																<span className="text-blue-600">
																	{
																		gestor.totalClientes
																	}
																</span>{" "}
																clientes
															</p>
														</div>

														<div className="mt-3 grid grid-cols-2 gap-2">
															{Object.entries(
																gestor.statusCount,
															).map(
																([
																	status,
																	count,
																]) => (
																	<div
																		key={
																			status
																		}
																		className="flex items-center gap-1"
																	>
																		<div
																			className="w-2 h-2 rounded-full shrink-0"
																			style={{
																				backgroundColor:
																					STATUS_COLORS[
																						status as keyof typeof STATUS_COLORS
																					],
																			}}
																		/>
																		<span className="text-xs text-gray-600 capitalize truncate">
																			{
																				status
																			}
																			:{" "}
																			<span className="font-semibold">
																				{
																					count
																				}
																			</span>
																		</span>
																	</div>
																),
															)}
														</div>
													</div>
												</div>
											</div>
										))}
									</div>
								</div>
							) : (
								<div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
									<div className="flex items-start">
										<div className="shrink-0">
											<span className="text-yellow-600 text-xl">
												⚠️
											</span>
										</div>
										<div className="ml-3">
											<h2 className="text-lg font-semibold text-yellow-800">
												Nenhum gestor encontrado
											</h2>
											<div className="mt-2 text-yellow-700">
												<p>
													Ainda não tem gestores
													associados à sua empresa.
												</p>
												<p className="text-sm mt-1">
													<strong>Debug info:</strong>{" "}
													ID Empresa: {profile.id}
												</p>
											</div>
										</div>
									</div>
								</div>
							)}
						</>
					)}

					{/* Card de gestor */}
					{profile?.role === "gestor" && (
						<div className="bg-white p-6 rounded-lg shadow border">
							<div className="flex items-center gap-4">
								<div className="w-20 h-28 bg-gray-100 rounded-md flex items-center justify-center border shrink-0">
									<span className="text-gray-400 text-2xl">
										👤
									</span>
								</div>
								<div>
									<h2 className="text-xl font-bold">
										{profile.name}
									</h2>
									<p className="text-gray-600">
										{profile.email}
									</p>
									<p className="mt-2 font-semibold text-gray-800">
										Clientes associados:{" "}
										<strong>{clientes.length}</strong>
									</p>
									<p className="text-sm text-gray-500">
										Todos os clientes listados acima são
										seus
									</p>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
