"use client";

import {
	Calendar,
	ChevronRight,
	Download,
	Edit,
	Eye,
	FileText,
	Filter,
	Globe,
	Hash,
	LayoutDashboard,
	Mail,
	MapPin,
	Menu,
	Phone,
	Save,
	Search,
	Trash2,
	User as UserIcon,
	Users,
	X,
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
	dataFimContrato: string | null; // NOVO CAMPO
}

interface SupabaseUser {
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

	const [user, setUser] = useState<SupabaseUser | null>(null);
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

	// Estados para controlar os modais
	const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
	const [modalEditarOpen, setModalEditarOpen] = useState(false);
	const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(
		null,
	);
	const [clienteEditando, setClienteEditando] = useState<Cliente | null>(
		null,
	);
	const [editandoLoading, setEditandoLoading] = useState(false);

	// Estado para armazenar o nome do gestor/parceiro responsável
	const [responsavelNome, setResponsavelNome] = useState<string>("");

	useEffect(() => {
		console.log("🚀 ClientesPage montado - iniciando checkAuth");
		checkAuth();
	}, []);

	// Função para buscar o nome do responsável pelo profileId
	const buscarResponsavelNome = async (profileId: string) => {
		if (!profileId) {
			setResponsavelNome("Não vinculado");
			return;
		}

		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("name")
				.eq("id", profileId)
				.single();

			if (error) {
				console.error("❌ Erro ao buscar responsável:", error);
				setResponsavelNome("Não encontrado");
			} else {
				setResponsavelNome(data?.name || "Nome não disponível");
			}
		} catch (err) {
			console.error("💥 Erro inesperado ao buscar responsável:", err);
			setResponsavelNome("Erro ao buscar");
		}
	};

	// Buscar nome do responsável quando um cliente for selecionado para detalhes
	useEffect(() => {
		if (selectedCliente) {
			buscarResponsavelNome(selectedCliente.profileId);
		}
	}, [selectedCliente]);

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

			setUser(session.user as SupabaseUser);
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

			// MESMA LÓGICA DA DASHBOARD
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

		// Ordenação - CORRIGIDO
		if (sortConfig) {
			result.sort((a, b) => {
				const aVal = a[sortConfig.key];
				const bVal = b[sortConfig.key];

				// Tratar valores null/undefined
				if (aVal == null && bVal == null) {
					return 0;
				}
				if (aVal == null) {
					return sortConfig.direction === "asc" ? 1 : -1;
				}
				if (bVal == null) {
					return sortConfig.direction === "asc" ? -1 : 1;
				}

				// Converter para string para comparação segura
				const aStr = String(aVal).toLowerCase();
				const bStr = String(bVal).toLowerCase();

				if (aStr < bStr) {
					return sortConfig.direction === "asc" ? -1 : 1;
				}
				if (aStr > bStr) {
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

	// Função para formatar a data de fim de contrato
	const formatarDataFimContrato = (dataFimContrato: string | null) => {
		if (!dataFimContrato) {
			return "Não há";
		}
		return new Date(dataFimContrato).toLocaleDateString("pt-PT");
	};

	// FUNÇÕES PARA OS BOTÕES DE AÇÃO
	const handleVerDetalhes = (cliente: Cliente) => {
		console.log("🔍 Ver detalhes do cliente:", cliente);
		setSelectedCliente(cliente);
		setModalDetalhesOpen(true);
	};

	const handleEditar = (cliente: Cliente) => {
		console.log("✏️ Abrir edição do cliente:", cliente);
		setClienteEditando({ ...cliente });
		setModalEditarOpen(true);
	};

	const handleSalvarEdicao = async () => {
		if (!clienteEditando) {
			return;
		}

		console.log("💾 Salvando edição do cliente:", clienteEditando);
		setEditandoLoading(true);

		try {
			const { error } = await supabase
				.from("clientes")
				.update({
					name: clienteEditando.name,
					email: clienteEditando.email,
					telefone: clienteEditando.telefone,
					nif: clienteEditando.nif,
					codigoPostal: clienteEditando.codigoPostal,
					endereco: clienteEditando.endereco,
					status: clienteEditando.status,
					produto: clienteEditando.produto,
					updatedAt: new Date().toISOString(),
				})
				.eq("id", clienteEditando.id);

			if (error) {
				console.error("❌ Erro ao atualizar cliente:", error);
				alert(`Erro ao atualizar cliente: ${error.message}`);
				return;
			}

			console.log("✅ Cliente atualizado com sucesso");

			// Atualizar a lista de clientes
			if (profile) {
				await loadClientes(profile.role, profile.id);
			}

			// Fechar modal e limpar estados
			setModalEditarOpen(false);
			setClienteEditando(null);
			alert("Cliente atualizado com sucesso!");
		} catch (err) {
			console.error("💥 Erro inesperado ao atualizar cliente:", err);
			alert("Erro inesperado ao atualizar cliente");
		} finally {
			setEditandoLoading(false);
		}
	};

	const handleDeletar = async (clienteId: string, clienteNome: string) => {
		console.log("🗑️ Deletar cliente:", clienteId);

		if (
			!confirm(
				`Tem certeza que deseja deletar o cliente "${clienteNome}"? Esta ação não pode ser desfeita.`,
			)
		) {
			return;
		}

		try {
			const { error } = await supabase
				.from("clientes")
				.delete()
				.eq("id", clienteId);

			if (error) {
				console.error("❌ Erro ao deletar cliente:", error);
				alert(`Erro ao deletar cliente: ${error.message}`);
				return;
			}

			console.log("✅ Cliente deletado com sucesso");

			// Atualizar a lista de clientes
			if (profile) {
				await loadClientes(profile.role, profile.id);
			}

			alert("Cliente deletado com sucesso!");
		} catch (err) {
			console.error("💥 Erro inesperado ao deletar cliente:", err);
			alert("Erro inesperado ao deletar cliente");
		}
	};

	// Funções para fechar modais
	const closeModalDetalhes = () => {
		setModalDetalhesOpen(false);
		setSelectedCliente(null);
		setResponsavelNome("");
	};

	const closeModalEditar = () => {
		setModalEditarOpen(false);
		setClienteEditando(null);
	};

	// Função para lidar com tecla Escape nos modais
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (modalDetalhesOpen) {
					closeModalDetalhes();
				}
				if (modalEditarOpen) {
					closeModalEditar();
				}
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [modalDetalhesOpen, modalEditarOpen]);

	// Função para lidar com teclado no overlay
	const handleOverlayKeyDownModal = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
			e.preventDefault();
			if (modalDetalhesOpen) {
				closeModalDetalhes();
			}
			if (modalEditarOpen) {
				closeModalEditar();
			}
		}
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
			"Data Fim Contrato",
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
			cliente.dataFimContrato
				? new Date(cliente.dataFimContrato).toLocaleDateString("pt-BR")
				: "Não há",
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
											Data Fim Contrato
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
												colSpan={8}
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
													<div className="text-gray-600">
														{formatarDataFimContrato(
															cliente.dataFimContrato,
														)}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="flex items-center gap-2">
														<button
															type="button"
															onClick={() =>
																handleVerDetalhes(
																	cliente,
																)
															}
															className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
															title="Ver detalhes"
															aria-label={`Ver detalhes do cliente ${cliente.name}`}
														>
															<Eye size={18} />
														</button>
														<button
															type="button"
															onClick={() =>
																handleEditar(
																	cliente,
																)
															}
															className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
															title="Editar"
															aria-label={`Editar cliente ${cliente.name}`}
														>
															<Edit size={18} />
														</button>
														<button
															type="button"
															onClick={() =>
																handleDeletar(
																	cliente.id,
																	cliente.name,
																)
															}
															className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
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

			{/* MODAL DE DETALHES DO CLIENTE */}
			{modalDetalhesOpen && selectedCliente && (
				<>
					{/* Overlay escuro */}
					<button
						type="button"
						className="fixed inset-0 bg-black/50 z-50 transition-opacity"
						onClick={closeModalDetalhes}
						onKeyDown={handleOverlayKeyDownModal}
						tabIndex={0}
						aria-label="Fechar modal"
					/>

					{/* Modal */}
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
							{/* Header do Modal */}
							<div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
								<div className="flex items-center gap-4">
									<div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
										<UserIcon className="w-8 h-8 text-white" />
									</div>
									<div>
										<h2 className="text-2xl font-bold text-gray-900">
											{selectedCliente.name}
										</h2>
										<div className="flex items-center gap-2 mt-1">
											{getStatusBadge(
												selectedCliente.status,
											)}
											<span className="text-sm text-gray-500">
												ID:{" "}
												{selectedCliente.id.substring(
													0,
													8,
												)}
												...
											</span>
										</div>
									</div>
								</div>
								<button
									type="button"
									onClick={closeModalDetalhes}
									className="p-2 hover:bg-gray-100 rounded-full transition-colors"
									aria-label="Fechar"
								>
									<X className="w-6 h-6 text-gray-500" />
								</button>
							</div>

							{/* Conteúdo do Modal */}
							<div className="overflow-y-auto max-h-[calc(90vh-180px)]">
								<div className="p-6">
									{/* Informações Principais */}
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										{/* Coluna 1 */}
										<div className="space-y-6">
											{/* Contato */}
											<div className="bg-gray-50 p-4 rounded-xl">
												<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
													<Mail className="w-5 h-5 text-blue-600" />
													Informações de Contato
												</h3>
												<div className="space-y-3">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
															<Mail className="w-4 h-4 text-blue-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Email
															</p>
															<p className="font-medium">
																{
																	selectedCliente.email
																}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
															<Phone className="w-4 h-4 text-green-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Telefone
															</p>
															<p className="font-medium">
																{selectedCliente.telefone ||
																	"Não informado"}
															</p>
														</div>
													</div>
												</div>
											</div>

											{/* Documentos */}
											<div className="bg-gray-50 p-4 rounded-xl">
												<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
													<FileText className="w-5 h-5 text-purple-600" />
													Documentos
												</h3>
												<div className="space-y-3">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
															<Hash className="w-4 h-4 text-purple-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																NIF
															</p>
															<p className="font-medium">
																{selectedCliente.nif ||
																	"Não informado"}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>

										{/* Coluna 2 */}
										<div className="space-y-6">
											{/* Endereço */}
											<div className="bg-gray-50 p-4 rounded-xl">
												<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
													<MapPin className="w-5 h-5 text-red-600" />
													Endereço
												</h3>
												<div className="space-y-3">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
															<MapPin className="w-4 h-4 text-red-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Endereço
															</p>
															<p className="font-medium">
																{selectedCliente.endereco ||
																	"Não informado"}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
															<Globe className="w-4 h-4 text-orange-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Código Postal
															</p>
															<p className="font-medium">
																{selectedCliente.codigoPostal ||
																	"Não informado"}
															</p>
														</div>
													</div>
												</div>
											</div>

											{/* Produto e Status */}
											<div className="bg-gray-50 p-4 rounded-xl">
												<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
													<Globe className="w-5 h-5 text-green-600" />
													Informações Comerciais
												</h3>
												<div className="space-y-3">
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
															<Globe className="w-4 h-4 text-green-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Produto
															</p>
															<p className="font-medium">
																{selectedCliente.produto ||
																	"Não especificado"}
															</p>
														</div>
													</div>
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
															<div
																className="w-3 h-3 rounded-full"
																style={{
																	backgroundColor:
																		STATUS_COLORS[
																			selectedCliente.status as keyof typeof STATUS_COLORS
																		]?.split(
																			" ",
																		)[0] ||
																		"#6b7280",
																}}
															/>
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Status
															</p>
															<p className="font-medium capitalize">
																{
																	selectedCliente.status
																}
															</p>
														</div>
													</div>
													{/* NOVO: Data Fim Contrato */}
													<div className="flex items-center gap-3">
														<div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
															<Calendar className="w-4 h-4 text-indigo-600" />
														</div>
														<div className="flex-1">
															<p className="text-sm text-gray-500">
																Data Fim
																Contrato
															</p>
															<p className="font-medium">
																{formatarDataFimContrato(
																	selectedCliente.dataFimContrato,
																)}
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* Informações de Sistema */}
									<div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
										<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
											<Calendar className="w-5 h-5 text-gray-600" />
											Informações do Sistema
										</h3>
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<div className="bg-white p-4 rounded-lg border">
												<p className="text-sm text-gray-500">
													Data de Criação
												</p>
												<p className="font-medium">
													{new Date(
														selectedCliente.createdAt,
													).toLocaleDateString(
														"pt-BR",
													)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(
														selectedCliente.createdAt,
													).toLocaleTimeString(
														"pt-BR",
													)}
												</p>
											</div>
											<div className="bg-white p-4 rounded-lg border">
												<p className="text-sm text-gray-500">
													Última Atualização
												</p>
												<p className="font-medium">
													{new Date(
														selectedCliente.updatedAt,
													).toLocaleDateString(
														"pt-BR",
													)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(
														selectedCliente.updatedAt,
													).toLocaleTimeString(
														"pt-BR",
													)}
												</p>
											</div>
											<div className="bg-white p-4 rounded-lg border">
												<p className="text-sm text-gray-500">
													Responsável
												</p>
												<p className="font-medium truncate">
													{responsavelNome ||
														"Carregando..."}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Footer do Modal */}
							<div className="border-t border-gray-200 p-4 bg-gray-50">
								<div className="flex items-center justify-between">
									<div className="text-sm text-gray-500">
										Cliente cadastrado há{" "}
										{Math.floor(
											(Date.now() -
												new Date(
													selectedCliente.createdAt,
												).getTime()) /
												(1000 * 60 * 60 * 24),
										)}{" "}
										dias
									</div>
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={() => {
												handleEditar(selectedCliente);
												closeModalDetalhes();
											}}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
										>
											<Edit size={16} />
											Editar Cliente
										</button>
										<button
											type="button"
											onClick={() => {
												if (
													confirm(
														`Tem certeza que deseja excluir ${selectedCliente.name}?`,
													)
												) {
													handleDeletar(
														selectedCliente.id,
														selectedCliente.name,
													);
													closeModalDetalhes();
												}
											}}
											className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2"
										>
											<Trash2 size={16} />
											Excluir
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</>
			)}

			{/* MODAL DE EDITAR CLIENTE */}
			{modalEditarOpen && clienteEditando && (
				<>
					{/* Overlay escuro */}
					<button
						type="button"
						className="fixed inset-0 bg-black/50 z-50 transition-opacity"
						onClick={closeModalEditar}
						onKeyDown={handleOverlayKeyDownModal}
						tabIndex={0}
						aria-label="Fechar modal de edição"
					/>

					{/* Modal */}
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
							{/* Header do Modal */}
							<div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
								<div className="flex items-center gap-4">
									<div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
										<UserIcon className="w-8 h-8 text-white" />
									</div>
									<div>
										<h2 className="text-2xl font-bold text-gray-900">
											Editar Cliente
										</h2>
										<p className="text-gray-600 mt-1">
											{clienteEditando.name}
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={closeModalEditar}
									className="p-2 hover:bg-gray-100 rounded-full transition-colors"
									aria-label="Fechar"
								>
									<X className="w-6 h-6 text-gray-500" />
								</button>
							</div>

							{/* Conteúdo do Modal */}
							<div className="overflow-y-auto max-h-[calc(90vh-180px)]">
								<div className="p-6">
									{/* Formulário de Edição */}
									<form
										onSubmit={(e) => {
											e.preventDefault();
											handleSalvarEdicao();
										}}
										className="space-y-6"
									>
										{/* Informações Principais */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											{/* Coluna 1 */}
											<div className="space-y-6">
												{/* Contato */}
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<Mail className="w-5 h-5 text-blue-600" />
														Informações de Contato
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="edit-name"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Nome Completo
															</label>
															<input
																id="edit-name"
																type="text"
																value={
																	clienteEditando.name
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			name: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
															/>
														</div>
														<div>
															<label
																htmlFor="edit-email"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Email
															</label>
															<input
																id="edit-email"
																type="email"
																value={
																	clienteEditando.email
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			email: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
															/>
														</div>
														<div>
															<label
																htmlFor="edit-telefone"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Telefone
															</label>
															<input
																id="edit-telefone"
																type="tel"
																value={
																	clienteEditando.telefone ||
																	""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			telefone:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="(00) 00000-0000"
															/>
														</div>
													</div>
												</div>

												{/* Documentos */}
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<FileText className="w-5 h-5 text-purple-600" />
														Documentos
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="edit-nif"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																NIF
															</label>
															<input
																id="edit-nif"
																type="text"
																value={
																	clienteEditando.nif ||
																	""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			nif: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="000.000.000-00"
															/>
														</div>
													</div>
												</div>
											</div>

											{/* Coluna 2 */}
											<div className="space-y-6">
												{/* Endereço */}
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<MapPin className="w-5 h-5 text-red-600" />
														Endereço
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="edit-endereco"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Endereço
															</label>
															<input
																id="edit-endereco"
																type="text"
																value={
																	clienteEditando.endereco ||
																	""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			endereco:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="Rua, número, complemento"
															/>
														</div>
														<div>
															<label
																htmlFor="edit-codigo-postal"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Código Postal
															</label>
															<input
																id="edit-codigo-postal"
																type="text"
																value={
																	clienteEditando.codigoPostal ||
																	""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			codigoPostal:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="00000-000"
															/>
														</div>
													</div>
												</div>

												{/* Produto e Status */}
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<Globe className="w-5 h-5 text-green-600" />
														Informações Comerciais
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="edit-produto"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Produto
															</label>
															<input
																id="edit-produto"
																type="text"
																value={
																	clienteEditando.produto ||
																	""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			produto:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="Ex: Internet, TV, Telefone"
															/>
														</div>
														<div>
															<label
																htmlFor="edit-status"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Status
															</label>
															<select
																id="edit-status"
																value={
																	clienteEditando.status
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			status: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
															>
																{STATUS_OPTIONS.map(
																	(
																		status,
																	) => (
																		<option
																			key={
																				status
																			}
																			value={
																				status
																			}
																		>
																			{status
																				.charAt(
																					0,
																				)
																				.toUpperCase() +
																				status.slice(
																					1,
																				)}
																		</option>
																	),
																)}
															</select>
														</div>
													</div>
												</div>
											</div>
										</div>

										{/* Informações do Sistema (somente leitura) */}
										<div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 p-5 rounded-xl border border-gray-200">
											<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
												<Calendar className="w-5 h-5 text-gray-600" />
												Informações do Sistema
											</h3>
											<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
												<div className="bg-white p-4 rounded-lg border">
													<p className="text-sm text-gray-500">
														Data de Criação
													</p>
													<p className="font-medium">
														{new Date(
															clienteEditando.createdAt,
														).toLocaleDateString(
															"pt-BR",
														)}
													</p>
												</div>
												<div className="bg-white p-4 rounded-lg border">
													<p className="text-sm text-gray-500">
														Última Atualização
													</p>
													<p className="font-medium">
														{new Date(
															clienteEditando.updatedAt,
														).toLocaleDateString(
															"pt-BR",
														)}
													</p>
												</div>
												<div className="bg-white p-4 rounded-lg border">
													<p className="text-sm text-gray-500">
														Data Fim Contrato
													</p>
													<p className="font-medium">
														{formatarDataFimContrato(
															clienteEditando.dataFimContrato,
														)}
													</p>
												</div>
											</div>
										</div>
									</form>
								</div>
							</div>

							{/* Footer do Modal */}
							<div className="border-t border-gray-200 p-4 bg-gray-50">
								<div className="flex items-center justify-between">
									<div className="text-sm text-gray-500">
										ID do Cliente:{" "}
										{clienteEditando.id.substring(0, 8)}...
									</div>
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={closeModalEditar}
											className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
											disabled={editandoLoading}
										>
											<X size={16} />
											Cancelar
										</button>
										<button
											type="button"
											onClick={handleSalvarEdicao}
											disabled={editandoLoading}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{editandoLoading ? (
												<>
													<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
													Salvando...
												</>
											) : (
												<>
													<Save size={16} />
													Salvar Alterações
												</>
											)}
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
