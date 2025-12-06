"use client";

import {
	ChevronRight,
	Download,
	Edit,
	Eye,
	Filter,
	LayoutDashboard,
	Menu,
	Search,
	Trash2,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase/client";

interface Cliente {
	id: string;
	name: string;
	email: string;
	telefone: string;
	nif: string;
	codigoPostal: string;
	endereco: string;
	status: string;
	produto: string;
	createdAt: string;
	updatedAt: string;
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

const STATUS_OPTIONS = [
	"aprovado",
	"em análise",
	"aguardando documentos",
	"reprovado",
	"fidelizado",
];

const STATUS_COLORS = {
	aprovado: "bg-green-100 text-green-800 border-green-200",
	"em análise": "bg-yellow-100 text-yellow-800 border-yellow-200",
	"aguardando documentos": "bg-blue-100 text-blue-800 border-blue-200",
	reprovado: "bg-red-100 text-red-800 border-red-200",
	fidelizado: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function ClientesPage() {
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);

	const [user, setUser] = useState<User | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [clientes, setClientes] = useState<Cliente[]>([]);
	const [filteredClientes, setFilteredClientes] = useState<Cliente[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [selectedStatus, setSelectedStatus] = useState<string>("all");
	const [sortConfig, setSortConfig] = useState<{
		key: keyof Cliente;
		direction: "asc" | "desc";
	} | null>(null);
	const [page, setPage] = useState(1);
	const itemsPerPage = 20;

	useEffect(() => {
		console.log("🚀 ClientesPage montado - iniciando checkAuth");
		checkAuth();
	}, []);

	const checkAuth = async () => {
		console.group("🔐 CHECK AUTH - CLIENTES");
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
				await loadClientes(profileData.role, profileData.id);
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

	const loadClientes = async (userRole?: string, userId?: string) => {
		try {
			console.log(
				`📊 Carregando clientes para ${userRole} (ID: ${userId})`,
			);

			let query = supabase.from("clientes").select("*");

			// 🔥 MESMA LÓGICA DA DASHBOARD - IMPORTANTE!
			if (userRole === "tenant") {
				// Tenant vê TODOS os clientes do seu tenant
				query = query.eq("tenantId", userId);
			} else if (userRole === "gestor") {
				// Gestor vê apenas clientes vinculados a ele
				query = query.eq("profileId", userId);
			} else if (userRole === "parceiro") {
				// Parceiro também vê apenas seus clientes
				query = query.eq("profileId", userId);
			}
			// Outros roles ou sem role específica veem tudo?

			const { data, error } = await query.order("createdAt", {
				ascending: false,
			});

			if (error) {
				console.error("❌ Erro ao carregar clientes:", error);
				setClientes([]);
				setFilteredClientes([]);
				return;
			}

			console.log(
				`✅ ${data?.length || 0} clientes carregados para ${userRole}`,
			);
			setClientes(data || []);
			setFilteredClientes(data || []);
		} catch (err) {
			console.error("💥 Erro inesperado ao carregar clientes:", err);
			setClientes([]);
			setFilteredClientes([]);
		}
	};

	// 🔍 Filtros combinados
	useEffect(() => {
		let result = [...clientes];

		// Filtro por busca
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			result = result.filter(
				(cliente) =>
					cliente.name?.toLowerCase().includes(term) ||
					cliente.email?.toLowerCase().includes(term) ||
					cliente.telefone?.includes(term) ||
					cliente.nif?.includes(term) ||
					cliente.status?.toLowerCase().includes(term) ||
					cliente.produto?.toLowerCase().includes(term),
			);
		}

		// Filtro por status
		if (selectedStatus !== "all") {
			result = result.filter(
				(cliente) => cliente.status === selectedStatus,
			);
		}

		// Ordenação
		if (sortConfig) {
			result.sort((a, b) => {
				const aVal = a[sortConfig.key];
				const bVal = b[sortConfig.key];

				if (aVal < bVal) {
					return sortConfig.direction === "asc" ? -1 : 1;
				}
				if (aVal > bVal) {
					return sortConfig.direction === "asc" ? 1 : -1;
				}
				return 0;
			});
		}

		setFilteredClientes(result);
		setPage(1); // Resetar para primeira página ao filtrar
	}, [clientes, searchTerm, selectedStatus, sortConfig]);

	const handleSort = (key: keyof Cliente) => {
		setSortConfig((current) => {
			if (current?.key === key) {
				return {
					key,
					direction: current.direction === "asc" ? "desc" : "asc",
				};
			}
			return { key, direction: "asc" };
		});
	};

	// Funções de navegação e acessibilidade
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

	// Corrigido: Função com tipo explícito
	const getStatusBadge = (status: string) => {
		const colorClass =
			STATUS_COLORS[status as keyof typeof STATUS_COLORS] ||
			"bg-gray-100 text-gray-800 border-gray-200";
		return (
			<span
				className={`px-2 py-1 text-xs font-medium rounded-full border ${colorClass}`}
			>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</span>
		);
	};

	const exportToCSV = () => {
		const headers = [
			"Nome",
			"Email",
			"Telefone",
			"NIF",
			"Status",
			"Produto",
			"Código Postal",
			"Endereço",
			"Data Criação",
		];
		const csvData = filteredClientes.map((cliente) => [
			cliente.name,
			cliente.email,
			cliente.telefone,
			cliente.nif,
			cliente.status,
			cliente.produto,
			cliente.codigoPostal,
			cliente.endereco,
			new Date(cliente.createdAt).toLocaleDateString("pt-BR"),
		]);

		const csvContent = [
			headers.join(","),
			...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
		].join("\n");

		const blob = new Blob([csvContent], {
			type: "text/csv;charset=utf-8;",
		});
		const link = document.createElement("a");
		const url = URL.createObjectURL(blob);
		link.setAttribute("href", url);
		link.setAttribute(
			"download",
			`clientes_${new Date().toISOString().split("T")[0]}.csv`,
		);
		link.style.visibility = "hidden";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	// Paginação
	const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
	const startIndex = (page - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedClientes = filteredClientes.slice(startIndex, endIndex);

	if (loading) {
		return (
			<div className="p-6">
				<div className="flex items-center justify-center h-64">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
				</div>
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
					{/* Header */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div>
							<h1 className="text-3xl font-bold text-gray-800">
								Lista de Clientes
								{profile?.role && (
									<span className="text-sm ml-2 text-gray-500">
										({profile.role})
									</span>
								)}
							</h1>
							<p className="text-gray-600 mt-1">
								{clientes.length} clientes encontrados •{" "}
								{filteredClientes.length} após filtros
							</p>
						</div>

						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={exportToCSV}
								className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
							>
								<Download size={18} />
								Exportar CSV
							</button>
						</div>
					</div>

					{/* Filtros */}
					<div className="bg-white p-4 rounded-lg shadow border">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{/* Busca */}
							<div>
								<label
									htmlFor="search-input"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									<Search size={16} className="inline mr-1" />
									Buscar cliente
								</label>
								<div className="relative">
									<Search
										className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
										size={20}
									/>
									<input
										id="search-input"
										type="text"
										placeholder="Buscar cliente (nome, email, telefone, NIF...)"
										value={searchTerm}
										onChange={(e) =>
											setSearchTerm(e.target.value)
										}
										className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
									/>
								</div>
							</div>

							{/* Filtro por Status */}
							<div>
								<label
									htmlFor="status-filter"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									<Filter size={16} className="inline mr-1" />
									Status
								</label>
								<select
									id="status-filter"
									value={selectedStatus}
									onChange={(e) =>
										setSelectedStatus(e.target.value)
									}
									className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
								>
									<option value="all">Todos os status</option>
									{STATUS_OPTIONS.map((status) => (
										<option key={status} value={status}>
											{status.charAt(0).toUpperCase() +
												status.slice(1)}
										</option>
									))}
								</select>
							</div>

							{/* Filtro por Produto */}
							<div>
								<label
									htmlFor="product-filter"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Produto
								</label>
								<select
									id="product-filter"
									className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
									onChange={(e) => {
										if (e.target.value) {
											setSearchTerm(e.target.value);
										}
									}}
								>
									<option value="">Todos os produtos</option>
									{Array.from(
										new Set(
											clientes
												.map((c) => c.produto)
												.filter(Boolean),
										),
									).map((produto) => (
										<option key={produto} value={produto}>
											{produto}
										</option>
									))}
								</select>
							</div>
						</div>

						{/* Quick Status Filters */}
						<div className="flex flex-wrap gap-2 mt-4">
							<button
								type="button"
								onClick={() => setSelectedStatus("all")}
								className={`px-3 py-1 text-sm rounded-full ${selectedStatus === "all" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
							>
								Todos ({clientes.length})
							</button>
							{STATUS_OPTIONS.map((status) => {
								const count = clientes.filter(
									(c) => c.status === status,
								).length;
								return (
									<button
										type="button"
										key={status}
										onClick={() =>
											setSelectedStatus(status)
										}
										className={`px-3 py-1 text-sm rounded-full ${selectedStatus === status ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
									>
										{status.charAt(0).toUpperCase() +
											status.slice(1)}{" "}
										({count})
									</button>
								);
							})}
						</div>
					</div>

					{/* Tabela */}
					<div className="bg-white rounded-lg shadow border overflow-hidden">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() => handleSort("name")}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" ||
													e.key === " "
												) {
													e.preventDefault();
													handleSort("name");
												}
											}}
											tabIndex={0}
											aria-label="Ordenar por nome"
										>
											<div className="flex items-center gap-1">
												Nome
												{sortConfig?.key === "name" && (
													<span>
														{sortConfig.direction ===
														"asc"
															? "↑"
															: "↓"}
													</span>
												)}
											</div>
										</th>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() => handleSort("email")}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" ||
													e.key === " "
												) {
													e.preventDefault();
													handleSort("email");
												}
											}}
											tabIndex={0}
											aria-label="Ordenar por email"
										>
											<div className="flex items-center gap-1">
												Email
												{sortConfig?.key ===
													"email" && (
													<span>
														{sortConfig.direction ===
														"asc"
															? "↑"
															: "↓"}
													</span>
												)}
											</div>
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Telefone
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											NIF
										</th>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() => handleSort("status")}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" ||
													e.key === " "
												) {
													e.preventDefault();
													handleSort("status");
												}
											}}
											tabIndex={0}
											aria-label="Ordenar por status"
										>
											<div className="flex items-center gap-1">
												Status
												{sortConfig?.key ===
													"status" && (
													<span>
														{sortConfig.direction ===
														"asc"
															? "↑"
															: "↓"}
													</span>
												)}
											</div>
										</th>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() =>
												handleSort("produto")
											}
											onKeyDown={(e) => {
												if (
													e.key === "Enter" ||
													e.key === " "
												) {
													e.preventDefault();
													handleSort("produto");
												}
											}}
											tabIndex={0}
											aria-label="Ordenar por produto"
										>
											<div className="flex items-center gap-1">
												Produto
												{sortConfig?.key ===
													"produto" && (
													<span>
														{sortConfig.direction ===
														"asc"
															? "↑"
															: "↓"}
													</span>
												)}
											</div>
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Ações
										</th>
									</tr>
								</thead>
								<tbody className="bg-white divide-y divide-gray-200">
									{paginatedClientes.length === 0 ? (
										<tr>
											<td
												colSpan={7}
												className="px-6 py-12 text-center text-gray-500"
											>
												<div className="flex flex-col items-center justify-center">
													<div className="text-gray-400 mb-2">
														📭
													</div>
													<p className="text-lg font-medium">
														Nenhum cliente
														encontrado
													</p>
													<p className="text-sm mt-1">
														Tente ajustar os filtros
														de busca
													</p>
												</div>
											</td>
										</tr>
									) : (
										paginatedClientes.map((cliente) => (
											<tr
												key={cliente.id}
												className="hover:bg-gray-50"
											>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="font-medium text-gray-900">
														{cliente.name}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-gray-600">
														{cliente.email}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-gray-600">
														{cliente.telefone ||
															"-"}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-gray-600">
														{cliente.nif || "-"}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													{getStatusBadge(
														cliente.status,
													)}
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-gray-600">
														{cliente.produto || "-"}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<button
															type="button"
															className="p-1 text-blue-600 hover:bg-blue-50 rounded"
															title="Ver detalhes"
															aria-label={`Ver detalhes do cliente ${cliente.name}`}
														>
															<Eye size={18} />
														</button>
														<button
															type="button"
															className="p-1 text-green-600 hover:bg-green-50 rounded"
															title="Editar"
															aria-label={`Editar cliente ${cliente.name}`}
														>
															<Edit size={18} />
														</button>
														<button
															type="button"
															className="p-1 text-red-600 hover:bg-red-50 rounded"
															title="Excluir"
															aria-label={`Excluir cliente ${cliente.name}`}
														>
															<Trash2 size={18} />
														</button>
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

						{/* Paginação */}
						{totalPages > 1 && (
							<div className="px-6 py-4 border-t border-gray-200">
								<div className="flex items-center justify-between">
									<div className="text-sm text-gray-700">
										Mostrando{" "}
										<span className="font-medium">
											{startIndex + 1}
										</span>{" "}
										a{" "}
										<span className="font-medium">
											{Math.min(
												endIndex,
												filteredClientes.length,
											)}
										</span>{" "}
										de{" "}
										<span className="font-medium">
											{filteredClientes.length}
										</span>{" "}
										clientes
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={() =>
												setPage((p) =>
													Math.max(1, p - 1),
												)
											}
											disabled={page === 1}
											className={`px-3 py-1 rounded border ${page === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50"}`}
											aria-label="Página anterior"
										>
											Anterior
										</button>
										<div className="flex items-center gap-1">
											{Array.from(
												{
													length: Math.min(
														5,
														totalPages,
													),
												},
												(_, i) => {
													let pageNum: number;
													if (totalPages <= 5) {
														pageNum = i + 1;
													} else if (page <= 3) {
														pageNum = i + 1;
													} else if (
														page >=
														totalPages - 2
													) {
														pageNum =
															totalPages - 4 + i;
													} else {
														pageNum = page - 2 + i;
													}
													return (
														<button
															type="button"
															key={pageNum}
															onClick={() =>
																setPage(pageNum)
															}
															className={`w-8 h-8 rounded ${page === pageNum ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100 border"}`}
															aria-label={`Ir para página ${pageNum}`}
															aria-current={
																page === pageNum
																	? "page"
																	: undefined
															}
														>
															{pageNum}
														</button>
													);
												},
											)}
											{totalPages > 5 && (
												<span className="px-2">
													...
												</span>
											)}
										</div>
										<button
											type="button"
											onClick={() =>
												setPage((p) =>
													Math.min(totalPages, p + 1),
												)
											}
											disabled={page === totalPages}
											className={`px-3 py-1 rounded border ${page === totalPages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50"}`}
											aria-label="Próxima página"
										>
											Próxima
										</button>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* Estatísticas rápidas */}
					<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
						{STATUS_OPTIONS.map((status) => {
							const count = clientes.filter(
								(c) => c.status === status,
							).length;
							const percentage =
								clientes.length > 0
									? ((count / clientes.length) * 100).toFixed(
											1,
										)
									: "0";
							return (
								<div
									key={status}
									className="bg-white p-4 rounded-lg shadow border"
								>
									<div className="flex items-center justify-between">
										<div>
											<p className="text-sm text-gray-500 capitalize">
												{status}
											</p>
											<p className="text-2xl font-bold mt-1">
												{count}
											</p>
										</div>
										<div
											className={`w-12 h-12 rounded-full flex items-center justify-center ${STATUS_COLORS[status as keyof typeof STATUS_COLORS].split(" ")[0]}`}
										>
											<span className="text-lg font-bold">
												{percentage}%
											</span>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
