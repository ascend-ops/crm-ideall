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

			// 🔹 Criar profileData SEM depender de estado assíncrono
			let role = session.user.user_metadata?.role;
			let profileData: Profile | null = null;

			if (!role) {
				// Buscar do banco se não está no metadata
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
				// Criar do metadata
				profileData = {
					id: session.user.id,
					name: session.user.email
						? session.user.email.split("@")[0]
						: "Usuário",
					email: session.user.email ?? "sem-email@exemplo.com",
					role: role,
				};
			}

			// 🔹 AGORA setar estado
			if (profileData) {
				setProfile(profileData);

				// 🔥 CARREGA CLIENTES (passando role)
				await loadClientes(profileData.role);

				// 🔥 NOVO: Se for tenant, carregar cards dos gestores (passando id como tenantId)
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
		try {
			console.log(
				"👥 Carregando cards dos gestores para tenant:",
				tenantId,
			);

			// 🔥 MUDANÇA CHAVE: SEM WHERE CLAUSES!
			const { data: todosProfiles, error } = await supabase
				.from("profiles")
				.select('id, name, email, role, "tenantId"')
				.order("name");

			if (error) {
				console.error("❌ Erro ao carregar profiles:", error);
				return;
			}

			console.log(`📊 ${todosProfiles?.length || 0} profiles carregados`);

			// Filtrar MANUALMENTE no frontend
			const gestores =
				todosProfiles?.filter(
					(profile) =>
						profile.role === "gestor" &&
						profile.tenantId === tenantId,
				) || [];

			console.log(`🔍 ${gestores.length} gestores após filtro manual`);

			if (gestores.length === 0) {
				setGestoresCards([]);
				return;
			}

			// 2. Para cada gestor, contar clientes por status
			const gestoresComDados = await Promise.all(
				gestores.map(async (gestor) => {
					// Buscar clientes do gestor
					const { data: clientesGestor, error } = await supabase
						.from("clientes")
						.select("status")
						.eq("profileId", gestor.id);

					if (error) {
						console.error(
							`❌ Erro ao carregar clientes do gestor ${gestor.name}:`,
							error,
						);
						return null;
					}

					// Contar por status
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
						totalClientes: clientesGestor?.length || 0,
						statusCount,
					};
				}),
			);

			// Filtrar nulos e atualizar estado
			const dadosValidos = gestoresComDados.filter(
				Boolean,
			) as GestorCardData[];
			setGestoresCards(dadosValidos);
			console.log(`✅ ${dadosValidos.length} gestores processados`);
		} catch (err) {
			console.error("💥 Erro inesperado ao carregar gestores:", err);
			setGestoresCards([]);
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
		<div className="p-6 space-y-6">
			<h1 className="text-3xl font-bold text-gray-800">
				Dashboard de Clientes
				{profile?.role && (
					<span className="text-sm ml-2 text-gray-500">
						({profile.role})
					</span>
				)}
			</h1>

			{/* Info do usuário */}
			<div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
				<h2 className="text-lg font-semibold text-blue-800">
					👋 Olá, {user.email}
				</h2>
				<p className="text-blue-600">
					Total de clientes: <strong>{clientes.length}</strong>
				</p>
				{profile?.role && (
					<p className="text-blue-600">
						Role: <strong>{profile.role}</strong>
					</p>
				)}
				{profile?.role === "tenant" && (
					<p className="text-blue-600 mt-2">
						Gestores: <strong>{gestoresCards.length}</strong>
					</p>
				)}
			</div>

			{/* 🔹 CARDS DOS GESTORES (apenas para tenant) */}
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
											{/* Avatar do gestor */}
											<div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center border border-blue-200 shrink-0">
												<span className="text-blue-600 text-xl font-bold">
													{gestor.name
														.charAt(0)
														.toUpperCase()}
												</span>
											</div>

											{/* Info do gestor */}
											<div className="flex-1 min-w-0">
												<h3 className="font-bold text-lg text-gray-800 truncate">
													{gestor.name}
												</h3>
												<p className="text-sm text-gray-600 truncate">
													{gestor.email}
												</p>

												{/* Total de clientes */}
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

												{/* Distribuição por status */}
												<div className="mt-3 grid grid-cols-2 gap-2">
													{Object.entries(
														gestor.statusCount,
													).map(([status, count]) => (
														<div
															key={status}
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
																{status}:{" "}
																<span className="font-semibold">
																	{count}
																</span>
															</span>
														</div>
													))}
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
											<strong>Debug info:</strong> Tenant
											ID: {profile.id}
										</p>
									</div>
								</div>
							</div>
						</div>
					)}
				</>
			)}

			{/* Gráfico geral */}
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
						<Tooltip />
						<Legend />
						<Bar dataKey="quantidade" fill="#8884d8" />
					</BarChart>
				</ResponsiveContainer>
			</div>

			{/* 🔹 CARD DO GESTOR (apenas para gestor individual) */}
			{profile?.role === "gestor" && (
				<div className="bg-white p-6 rounded-lg shadow border">
					<div className="flex items-center gap-4">
						<div className="w-20 h-28 bg-gray-100 rounded-md flex items-center justify-center border shrink-0">
							<span className="text-gray-400 text-2xl">👤</span>
						</div>
						<div>
							<h2 className="text-xl font-bold">
								{profile.name}
							</h2>
							<p className="text-gray-600">{profile.email}</p>
							<p className="mt-2 font-semibold text-gray-800">
								Clientes vinculados:{" "}
								<strong>{clientes.length}</strong>
							</p>
							<p className="text-sm text-gray-500">
								Todos os clientes listados acima são seus
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
