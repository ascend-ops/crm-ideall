"use client";

import { ChevronRight, LayoutDashboard, Menu, Users } from "lucide-react";
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
		"aguardando documentos": number;
		reprovado: number;
		fidelizado: number;
	};
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
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [gestoresCards, setGestoresCards] = useState<GestorCardData[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		console.log("🚀 Dashboard montado - iniciando checkAuth");
		checkAuth();
	}, []);

	const checkAuth = async () => {
		console.group("🔐 CHECK AUTH - DASHBOARD");
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
			console.log("🔹 USER METADATA:", session.user.user_metadata);

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

				await loadClientes(profileData.role);

				if (profileData.role === "tenant") {
					await loadGestoresCards(profileData.id);
				}
			} else {
				console.error("❌ Profile não encontrado");
				router.push("/auth/login");
			}
		} catch (error) {
			console.error("💥 Erro inesperado no checkAuth:", error);
			router.push("/auth/login");
		} finally {
			setLoading(false);
			console.groupEnd();
		}
	};

	const loadClientes = async (userRole?: string) => {
		try {
			const { data, error } = await supabase
				.from("clientes")
				.select("status, name, email");

			if (error) {
				console.error("❌ Erro ao carregar clientes:", error);
				setClientes([]);
				return;
			}

			console.log(
				`✅ ${data?.length || 0} clientes carregados para ${userRole || "desconhecido"}`,
			);
			setClientes(data || []);
		} catch (err) {
			console.error("💥 Erro inesperado ao carregar clientes:", err);
			setClientes([]);
		}
	};

	const loadGestoresCards = async (tenantId: string) => {
		console.group("🔍 DEBUG COMPLETO loadGestoresCards");

		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session) {
				return;
			}

			const { data: _simpleTest, error: simpleError } = await supabase
				.from("profiles")
				.select("id, email")
				.eq("id", session.user.id)
				.single();

			if (simpleError) {
				return;
			}

			const { data: teamMembers, error } = await supabase
				.from("profiles")
				.select('id, name, email, role, "tenantId"')
				.in("role", ["gestor", "parceiro"])
				.eq("tenantId", tenantId)
				.order("role", { ascending: false })
				.order("name", { ascending: true });

			if (!error && teamMembers) {
				const gestores = teamMembers.filter((p) => p.role === "gestor");

				const gestoresComDados = await Promise.all(
					gestores.map(async (gestor) => {
						const { data: clientesGestor } = await supabase
							.from("clientes")
							.select("status, id")
							.eq("profileId", gestor.id);

						const statusCount = {
							aprovado: 0,
							"em análise": 0,
							"aguardando documentos": 0,
							reprovado: 0,
							fidelizado: 0,
						};

						clientesGestor?.forEach((cliente) => {
							if (cliente.status in statusCount) {
								statusCount[
									cliente.status as keyof typeof statusCount
								]++;
							}
						});

						return {
							id: gestor.id,
							name: gestor.name,
							email: gestor.email,
							role: gestor.role,
							totalClientes: clientesGestor?.length || 0,
							statusCount,
						};
					}),
				);

				const dadosValidos = gestoresComDados.filter(
					Boolean,
				) as GestorCardData[];

				setGestoresCards(dadosValidos);
			}
		} catch (err) {
			console.error("💥 ERRO INESPERADO em loadGestoresCards:", err);
			setGestoresCards([]);
		} finally {
			console.groupEnd();
		}
	};

	useEffect(() => {
		console.log("🔄 Estado atualizado:", {
			loading,
			user: user?.email,
			clientesCount: clientes.length,
			role: profile?.role,
			gestoresCount: gestoresCards.length,
		});
	}, [loading, user, clientes, profile, gestoresCards]);

	const chartData = STATUS_ORDER.map((status) => {
		const count = clientes.filter((c) => c.status === status).length;
		return {
			status: status.charAt(0).toUpperCase() + status.slice(1),
			quantidade: count,
			fill: STATUS_COLORS[status as keyof typeof STATUS_COLORS],
		};
	});

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

	if (loading) {
		return (
			<div className="p-6">
				<h1 className="text-2xl font-bold">Carregando...</h1>
			</div>
		);
	}

	if (!user || !profile) {
		return null;
	}

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
					{/* 🔥 BOTÃO DE EXPANDIR/RETRAIR (DESKTOP) */}
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
								LeadFlow
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
							👋 Olá, {user.email}
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

					{/* Gestores */}
					{profile?.role === "tenant" && (
						<>
							{gestoresCards.length > 0 ? (
								<div className="bg-white p-6 rounded-lg shadow border">
									<h2 className="text-xl font-semibold mb-6 text-gray-800">
										Gestores do Seu Tenant
										<span className="text-sm font-normal ml-2 text-gray-500">
											({gestoresCards.length} gestores)
										</span>
									</h2>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
										{gestoresCards.map((gestor) => (
											<div
												key={gestor.id}
												className="border rounded-lg p-4 hover:shadow-md transition-shadow"
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
													Você ainda não tem gestores
													vinculados ao seu tenant.
												</p>
												<p className="text-sm mt-1">
													<strong>Debug info:</strong>{" "}
													Tenant ID: {profile.id}
												</p>
											</div>
										</div>
									</div>
								</div>
							)}
						</>
					)}

					{/* Gráfico */}
					<div className="bg-white p-6 rounded-lg shadow border">
						<h2 className="text-xl font-semibold mb-6 text-gray-800">
							Distribuição por Status
							{profile?.role === "gestor" && (
								<span className="text-sm font-normal ml-2 text-gray-500">
									(Seus clientes)
								</span>
							)}
							{profile?.role === "tenant" && (
								<span className="text-sm font-normal ml-2 text-gray-500">
									(Todos os clientes do tenant)
								</span>
							)}
						</h2>

						<ResponsiveContainer width="100%" height={400}>
							<BarChart
								data={chartData}
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
									angle={-45}
									textAnchor="end"
									height={80}
									tick={{ fontSize: 12 }}
								/>
								<YAxis />
								<Tooltip />
								<Legend />
								<Bar dataKey="quantidade" fill="#8884d8" />
							</BarChart>
						</ResponsiveContainer>
					</div>

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
										Clientes vinculados:{" "}
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
