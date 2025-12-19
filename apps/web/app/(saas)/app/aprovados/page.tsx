"use client";

import {
	ChevronRight,
	LayoutDashboard,
	Menu,
	TrendingUp,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { supabase } from "../../../../lib/supabase/client";

interface Cliente {
	status: string;
	createdAt: string;
	profileId: string;
	tenantId: string;
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

interface MonthlyData {
	month: string;
	aprovados: number;
}

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

const MONTHS_ABREVIADO = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
];

export default function GraficoAprovadosPage() {
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [chartData, setChartData] = useState<MonthlyData[]>([]);

	// Estado para filtro de ano
	const [selectedYear, setSelectedYear] = useState<string>(
		new Date().getFullYear().toString(),
	);
	const [availableYears, setAvailableYears] = useState<number[]>([]);

	useEffect(() => {
		checkAuth();
	}, []);

	useEffect(() => {
		if (clientes.length > 0 && selectedYear) {
			processChartData();
			updateAvailableYears();
		}
	}, [clientes, selectedYear]);

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

			let role = session.user.user_metadata?.role;
			let profileData: Profile | null = null;

			if (!role) {
				const { data } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", session.user.id)
					.single();

				if (data) {
					profileData = data;
					role = data.role;
				}
			} else {
				profileData = {
					id: session.user.id,
					name: session.user.email
						? session.user.email.split("@")[0]
						: "Usuário",
					email: session.user.email ?? "sem-email@exemplo.com",
					role: role,
				};
			}

			if (profileData) {
				setProfile(profileData);
				await loadClientes(profileData.role, profileData.id);
			} else {
				router.push("/auth/login");
			}
		} catch (error) {
			console.error("Erro no checkAuth:", error);
			router.push("/auth/login");
		} finally {
			setLoading(false);
		}
	};

	const loadClientes = async (userRole?: string, userId?: string) => {
		try {
			let query = supabase
				.from("clientes")
				.select("status, createdAt, profileId, tenantId");

			if (userRole === "tenant") {
				// Tenant vê TODOS os clientes do SEU tenant
				query = query.eq("tenantId", userId);
			} else if (userRole === "gestor") {
				// Gestor vê APENAS clientes que ELE criou (profileId = seu ID)
				query = query.eq("profileId", userId);
			} else if (userRole === "parceiro") {
				// Parceiro vê APENAS clientes onde ele é o responsável
				query = query.eq("responsavelId", userId);
			}

			const { data, error } = await query;

			if (error) {
				console.error("Erro ao carregar clientes:", error);
				setClientes([]);
				return;
			}

			console.log(
				`${data?.length || 0} clientes carregados para ${userRole}`,
			);
			setClientes(data || []);
		} catch (err) {
			console.error("Erro inesperado ao carregar clientes:", err);
			setClientes([]);
		}
	};

	const updateAvailableYears = () => {
		const years = new Set<number>();
		const currentYear = new Date().getFullYear();

		// Adiciona o ano atual
		years.add(currentYear);

		// Adiciona anos das datas de criação dos clientes
		clientes.forEach((cliente) => {
			try {
				const date = new Date(cliente.createdAt);
				const year = date.getFullYear();
				if (!Number.isNaN(year)) {
					years.add(year);
				}
			} catch (_e) {
				// Ignora datas inválidas
			}
		});

		// Converte para array e ordena em ordem decrescente
		const yearsArray = Array.from(years).sort((a, b) => b - a);
		setAvailableYears(yearsArray);

		// Se o ano selecionado não está na lista, seleciona o ano mais recente
		if (
			!years.has(Number.parseInt(selectedYear)) &&
			yearsArray.length > 0
		) {
			setSelectedYear(yearsArray[0].toString());
		}
	};

	const processChartData = () => {
		if (!selectedYear || clientes.length === 0) {
			setChartData([]);
			return;
		}

		// Inicializa os dados para todos os meses com 0 aprovados
		const monthlyData: MonthlyData[] = MONTHS.map((_month, index) => ({
			month: MONTHS_ABREVIADO[index],
			aprovados: 0,
		}));

		// Filtra clientes aprovados no ano selecionado
		const yearNum = Number.parseInt(selectedYear);
		const clientesAprovados = clientes.filter((cliente) => {
			try {
				const date = new Date(cliente.createdAt);
				const year = date.getFullYear();
				const _month = date.getMonth(); // 0 = Janeiro, 11 = Dezembro

				return cliente.status === "aprovado" && year === yearNum;
			} catch (_e) {
				return false;
			}
		});

		// Conta clientes aprovados por mês
		clientesAprovados.forEach((cliente) => {
			try {
				const date = new Date(cliente.createdAt);
				const month = date.getMonth(); // 0 = Janeiro, 11 = Dezembro

				if (month >= 0 && month <= 11) {
					monthlyData[month].aprovados++;
				}
			} catch (_e) {
				// Ignora datas inválidas
			}
		});

		setChartData(monthlyData);
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

	const handleOverlayClick = () => {
		setSidebarOpen(false);
	};

	const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
			e.preventDefault();
			setSidebarOpen(false);
		}
	};

	// Calcular totais para exibição
	const totalAprovadosGeral = clientes.filter(
		(c) => c.status === "aprovado",
	).length;
	const totalAprovadosAno = chartData.reduce(
		(sum, item) => sum + item.aprovados,
		0,
	);

	if (loading) {
		return (
			<div className="flex min-h-screen bg-gray-50">
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
						<p className="text-gray-600">Carregando...</p>
					</div>
				</div>
			</div>
		);
	}

	if (!user || !profile) {
		return null;
	}

	return (
		<div className="flex min-h-screen bg-gray-50">
			{/* Sidebar - IDÊNTICO À PÁGINA DE DASHBOARD */}
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

						{/* Gráfico de Aprovados (Atual) */}
						<button
							type="button"
							onClick={() => handleNavigation("/app/aprovados")}
							onKeyDown={(e) =>
								handleKeyDown(e, () =>
									handleNavigation("/app/aprovados"),
								)
							}
							className="flex items-center w-full p-3 rounded-lg bg-blue-50 text-blue-600 transition-colors group"
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
					{/* Cabeçalho igual ao da página de dashboard */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold text-gray-800">
								Gráfico de Clientes Aprovados
								{profile?.role && (
									<span className="text-sm ml-2 text-gray-500">
										({profile.role})
									</span>
								)}
							</h1>
							<p className="text-gray-600 mt-1">
								Evolução mensal de clientes com status
								"aprovado"
							</p>
						</div>

						<div className="flex items-center gap-4">
							{/* Filtro de Ano - igual ao da página de dashboard */}
							<div>
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
									className="w-full md:w-auto px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
								>
									{availableYears.map((year) => (
										<option key={year} value={year}>
											{year}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>

					{/* Card de boas-vindas igual ao da página de dashboard */}
					<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
						<h2 className="text-lg font-semibold text-blue-800">
							👋 Olá, {user.email}
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
							<div>
								<p className="text-blue-600">
									Total de clientes:{" "}
									<strong>{clientes.length}</strong>
								</p>
							</div>
							<div>
								<p className="text-blue-600">
									Total aprovados (geral):{" "}
									<strong>{totalAprovadosGeral}</strong>
								</p>
							</div>
							<div>
								<p className="text-blue-600">
									Aprovados em {selectedYear}:{" "}
									<strong>{totalAprovadosAno}</strong>
								</p>
							</div>
						</div>
					</div>

					{/* Gráfico de linha */}
					<div className="bg-white p-6 rounded-lg shadow border">
						<div className="mb-6">
							<h2 className="text-xl font-semibold text-gray-800">
								Evolução Mensal de Clientes Aprovados -{" "}
								{selectedYear}
							</h2>
							<p className="text-gray-600 mt-1">
								Linha contínua mostrando a quantidade de
								clientes com status "aprovado" criados em cada
								mês
							</p>
						</div>

						{/* Estatísticas resumidas */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
							<div className="bg-green-50 p-4 rounded-lg border border-green-200">
								<p className="text-sm text-green-700">
									Mês com mais aprovados
								</p>
								<p className="text-2xl font-bold text-green-800 mt-1">
									{chartData.length > 0
										? MONTHS[
												chartData.reduce(
													(maxIndex, item, index) =>
														item.aprovados >
														chartData[maxIndex]
															.aprovados
															? index
															: maxIndex,
													0,
												)
											]
										: "-"}
								</p>
								<p className="text-xs text-green-600 mt-1">
									{chartData.length > 0
										? `${Math.max(...chartData.map((d) => d.aprovados))} clientes`
										: "Sem dados"}
								</p>
							</div>

							<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
								<p className="text-sm text-blue-700">
									Mês atual
								</p>
								<p className="text-2xl font-bold text-blue-800 mt-1">
									{new Date().getMonth() >= 0 &&
									chartData.length > new Date().getMonth()
										? MONTHS_ABREVIADO[
												new Date().getMonth()
											]
										: "-"}
								</p>
								<p className="text-xs text-blue-600 mt-1">
									{new Date().getMonth() >= 0 &&
									chartData.length > new Date().getMonth()
										? `${chartData[new Date().getMonth()].aprovados} clientes`
										: "Fora do período"}
								</p>
							</div>

							<div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
								<p className="text-sm text-purple-700">
									Média mensal
								</p>
								<p className="text-2xl font-bold text-purple-800 mt-1">
									{totalAprovadosAno > 0
										? (
												totalAprovadosAno /
													chartData.filter(
														(d) => d.aprovados > 0,
													).length || 1
											).toFixed(1)
										: "0"}
								</p>
								<p className="text-xs text-purple-600 mt-1">
									clientes por mês
								</p>
							</div>

							<div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
								<p className="text-sm text-amber-700">
									Crescimento total
								</p>
								<p className="text-2xl font-bold text-amber-800 mt-1">
									{totalAprovadosAno}
								</p>
								<p className="text-xs text-amber-600 mt-1">
									em {selectedYear}
								</p>
							</div>
						</div>

						{/* Container do gráfico */}
						<div className="h-96">
							{chartData.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart
										data={chartData}
										margin={{
											top: 20,
											right: 30,
											left: 20,
											bottom: 20,
										}}
									>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke="#e5e7eb"
											horizontal={true}
											vertical={false}
										/>
										<XAxis
											dataKey="month"
											tick={{ fill: "#6b7280" }}
											axisLine={{ stroke: "#d1d5db" }}
											tickLine={{ stroke: "#d1d5db" }}
										/>
										<YAxis
											tick={{ fill: "#6b7280" }}
											axisLine={{ stroke: "#d1d5db" }}
											tickLine={{ stroke: "#d1d5db" }}
											label={{
												value: "Quantidade",
												angle: -90,
												position: "insideLeft",
												offset: 10,
												style: { fill: "#6b7280" },
											}}
										/>
										<Tooltip
											contentStyle={{
												backgroundColor: "white",
												border: "1px solid #d1d5db",
												borderRadius: "0.5rem",
												boxShadow:
													"0 4px 6px -1px rgba(0, 0, 0, 0.1)",
											}}
											labelStyle={{
												color: "#1f2937",
												fontWeight: "600",
											}}
											formatter={(value) => [
												`${value} clientes`,
												"Aprovados",
											]}
											labelFormatter={(label) =>
												`Mês: ${label}`
											}
										/>
										<Legend
											verticalAlign="top"
											height={36}
											wrapperStyle={{
												paddingBottom: "20px",
											}}
										/>
										<Line
											type="monotone"
											dataKey="aprovados"
											name="Clientes Aprovados"
											stroke="#10b981"
											strokeWidth={3}
											activeDot={{
												r: 8,
												fill: "#10b981",
											}}
											dot={{ r: 4, fill: "#10b981" }}
											animationDuration={1000}
										/>
									</LineChart>
								</ResponsiveContainer>
							) : (
								<div className="h-full flex flex-col items-center justify-center">
									<div className="text-gray-400 mb-4">
										<TrendingUp className="w-16 h-16" />
									</div>
									<p className="text-lg font-medium text-gray-700 mb-2">
										Nenhum dado disponível
									</p>
									<p className="text-gray-500 text-center max-w-md">
										Não há clientes aprovados no ano de{" "}
										{selectedYear} para exibir no gráfico.
										{clientes.length > 0 && (
											<span className="block mt-1">
												Tente selecionar outro ano ou
												verifique se há clientes com
												status "aprovado".
											</span>
										)}
									</p>
								</div>
							)}
						</div>

						{/* Legenda e informações adicionais */}
						<div className="mt-6 pt-6 border-t border-gray-200">
							<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
								<div className="text-sm text-gray-600">
									<p className="flex items-center gap-2">
										<span className="w-3 h-3 rounded-full bg-green-500" />
										<span>
											<strong>Linha verde:</strong>{" "}
											Evolução mensal de clientes
											aprovados
										</span>
									</p>
									<p className="mt-2">
										<strong>Nota:</strong> Apenas clientes
										com status "aprovado" são considerados
										neste gráfico.
									</p>
								</div>
								<div className="text-sm text-gray-500">
									<p>
										Total de meses com dados:{" "}
										{
											chartData.filter(
												(d) => d.aprovados > 0,
											).length
										}
										/12
									</p>
									<p className="mt-1">
										Atualizado em{" "}
										{new Date().toLocaleDateString("pt-PT")}
									</p>
								</div>
							</div>
						</div>
					</div>

					{/* Informações adicionais baseadas no perfil */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div className="bg-white p-6 rounded-lg shadow border">
							<h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
								<TrendingUp className="w-5 h-5 text-blue-600" />
								Sobre este Gráfico
							</h3>
							<div className="space-y-3">
								<p className="text-gray-600">
									Este gráfico mostra a evolução mensal de
									clientes com status{" "}
									<strong>"aprovado"</strong>.
								</p>
								<ul className="space-y-2 text-gray-600">
									<li className="flex items-start gap-2">
										<span className="text-green-500 mt-1">
											●
										</span>
										<span>
											Baseado nos dados de criação dos
											clientes
										</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-blue-500 mt-1">
											●
										</span>
										<span>
											Filtrado automaticamente por ano
											selecionado
										</span>
									</li>
									<li className="flex items-start gap-2">
										<span className="text-purple-500 mt-1">
											●
										</span>
										<span>
											Visualização contínua para análise
											de tendências
										</span>
									</li>
								</ul>
							</div>
						</div>

						<div className="bg-white p-6 rounded-lg shadow border">
							<h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
								<Users className="w-5 h-5 text-green-600" />
								Seus Dados ({profile.role})
							</h3>
							<div className="space-y-4">
								<div>
									<p className="text-sm text-gray-500">
										Visualização atual
									</p>
									<p className="font-medium">
										{profile.role === "tenant" &&
											"Todos os clientes do seu tenant"}
										{profile.role === "gestor" &&
											"Apenas seus clientes"}
										{profile.role === "parceiro" &&
											"Clientes atribuídos a você"}
									</p>
								</div>
								<div>
									<p className="text-sm text-gray-500">
										Período analisado
									</p>
									<p className="font-medium">
										Ano de {selectedYear}
									</p>
								</div>
								<div className="pt-4 border-t border-gray-200">
									<p className="text-sm text-gray-500">
										Total de clientes analisados
									</p>
									<p className="text-2xl font-bold text-gray-800">
										{clientes.length}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
