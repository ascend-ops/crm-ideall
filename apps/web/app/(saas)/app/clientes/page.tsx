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
	Link2,
	LogOut,
	Mail,
	MapPin,
	Menu,
	Phone,
	Plus,
	Save,
	Search,
	Trash2,
	TrendingUp,
	User as UserIcon,
	UserPlus,
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
	responsavelId: string;
	tenantId: string;
	dataFimContrato: string | null;
	parceiroNome?: string;
	parceiroRole?: string;
	gestorNome?: string;
	foiAtribuido?: boolean;
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
	tenantId?: string;
}

interface Parceiro {
	id: string;
	name: string;
	email: string;
}

interface Observacao {
	id: string;
	clienteId: string;
	profileId: string;
	texto: string;
	createdAt: string;
	profile_nome: string;
	profile_email: string;
	profile_role: string;
}

const STATUS_OPTIONS = [
	"aprovado",
	"em análise",
	"aguarda documentos",
	"reprovado",
	"fidelizado",
];

const STATUS_COLORS = {
	aprovado: "bg-green-100 text-green-800 border-green-200",
	"em análise": "bg-yellow-100 text-yellow-800 border-yellow-200",
	"aguarda documentos": "bg-blue-100 text-blue-800 border-blue-200",
	reprovado: "bg-red-100 text-red-800 border-red-200",
	fidelizado: "bg-purple-100 text-purple-800 border-purple-200",
};

// Opções de produto para dropdown
const PRODUTO_OPTIONS = ["internet", "energia", "painéis solares", "alarmes"];

// Função auxiliar para formatar datas para input type="date"
const formatDateForInput = (dateString: string | null): string => {
	if (!dateString) {
		return "";
	}

	try {
		const date = new Date(dateString);
		return date.toISOString().split("T")[0];
	} catch (_error) {
		return "";
	}
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
	const [selectedGestor, setSelectedGestor] = useState<string>("all");
	const [selectedParceiro, setSelectedParceiro] = useState<string>("all");
	const [sortConfig, setSortConfig] = useState<{
		key: keyof Cliente;
		direction: "asc" | "desc";
	} | null>(null);
	const [page, setPage] = useState(1);
	const itemsPerPage = 20;

	const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
	const [modalEditarOpen, setModalEditarOpen] = useState(false);
	const [modalAdicionarOpen, setModalAdicionarOpen] = useState(false);
	const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(
		null,
	);
	const [clienteEditando, setClienteEditando] = useState<Cliente | null>(
		null,
	);
	const [novoCliente, setNovoCliente] = useState({
		name: "",
		email: "",
		telefone: "",
		nif: "",
		codigoPostal: "",
		endereco: "",
		status: "em análise",
		produto: "",
		dataFimContrato: "",
	});
	const [editandoLoading, setEditandoLoading] = useState(false);
	const [adicionandoLoading, setAdicionandoLoading] = useState(false);

	const [parceirosDoGestor, setParceirosDoGestor] = useState<Parceiro[]>([]);
	const [parceiroSelecionado, setParceiroSelecionado] = useState<string>("");
	const [parceiroSelecionadoEdicao, setParceiroSelecionadoEdicao] =
		useState<string>("");
	const [responsavelNome, setResponsavelNome] = useState<string>("");

	// Estados para observações
	const [observacoes, setObservacoes] = useState<Observacao[]>([]);
	const [novaObservacao, setNovaObservacao] = useState<string>("");
	const [carregandoObservacoes, setCarregandoObservacoes] = useState(false);
	const [adicionandoObservacao, setAdicionandoObservacao] = useState(false);
	const [observacaoParaEliminar, setObservacaoParaEliminar] = useState<string | null>(null);
	const [eliminandoObservacao, setEliminandoObservacao] = useState(false);

	// Estados para modal "Adicionar Parceiro"
	const [modalAdicionarParceiroOpen, setModalAdicionarParceiroOpen] = useState(false);
	const [novoParceiro, setNovoParceiro] = useState({
		name: "",
		email: "",
		password: "",
		telefone: "",
		endereco: "",
		localidade: "",
		codigoPostal: "",
	});
	const [criandoParceiro, setCriandoParceiro] = useState(false);

	// Estados para modal "Gerir Parceiros" (associações gestor ↔ parceiro)
	const [modalGerirParceirosOpen, setModalGerirParceirosOpen] = useState(false);
	const [gestoresDoTenant, setGestoresDoTenant] = useState<{ id: string; name: string; email: string }[]>([]);
	const [associacoes, setAssociacoes] = useState<{ id: string; gestor_id: string; parceiro_id: string; gestor_nome: string; parceiro_nome: string }[]>([]);
	const [todosParceirosTenant, setTodosParceirosTenant] = useState<Parceiro[]>([]);
	const [gestorSelecionadoAssoc, setGestorSelecionadoAssoc] = useState<string>("");
	const [parceiroSelecionadoAssoc, setParceiroSelecionadoAssoc] = useState<string>("");
	const [carregandoAssociacoes, setCarregandoAssociacoes] = useState(false);

	useEffect(() => {
		checkAuth();
	}, []);

	useEffect(() => {
		if (selectedCliente) {
			buscarResponsavelNome(selectedCliente.profileId);
			// Carregar observações quando abrir modal de detalhes
			carregarObservacoes(selectedCliente.id);
		}
	}, [selectedCliente]);

	useEffect(() => {
		if (profile?.role === "gestor") {
			carregarParceirosDoGestor(profile.id);
		}
	}, [profile]);

	// Função para carregar observações com dados do perfil
	const carregarObservacoes = async (clienteId: string) => {
		if (!clienteId || !profile) {
			return;
		}

		setCarregandoObservacoes(true);
		try {
			const { data, error } = await supabase
				.from("observacoes")
				.select("*")
				.eq("clienteId", clienteId)
				.order("createdAt", { ascending: false });

			if (error) throw error;

			// Buscar nomes dos perfis separadamente (evita problemas com FK hints)
			const profileIds = [...new Set((data || []).map((obs: any) => obs.profileId))];
			let profileMap: Record<string, { name: string; role: string }> = {};

			if (profileIds.length > 0) {
				const { data: profiles } = await supabase
					.from("profiles")
					.select("id, name, role")
					.in("id", profileIds);

				if (profiles) {
					profileMap = Object.fromEntries(
						profiles.map((p: any) => [p.id, { name: p.name, role: p.role }])
					);
				}
			}

			const observacoesComPerfil =
				data?.map((obs: any) => ({
					id: obs.id,
					clienteId: obs.clienteId,
					profileId: obs.profileId,
					texto: obs.texto,
					createdAt: obs.createdAt,
					profile_nome: profileMap[obs.profileId]?.name || "Utilizador",
					profile_email: "",
					profile_role: profileMap[obs.profileId]?.role || "desconhecido",
				})) || [];

			setObservacoes(observacoesComPerfil);
		} catch (error) {
			console.error("Erro ao carregar observações:", error);
		} finally {
			setCarregandoObservacoes(false);
		}
	};

	// Função para adicionar nova observação
	const adicionarObservacao = async (
		clienteId: string,
		observacao: string,
	) => {
		if (!observacao.trim() || !profile) {
			return;
		}

		setAdicionandoObservacao(true);
		try {
			let tenantId: string | undefined = profile.tenantId;
			if (!tenantId) {
				if (profile.role === "tenant") {
					tenantId = profile.id;
				} else {
					const { data: p } = await supabase
						.from("profiles")
						.select("tenantId")
						.eq("id", profile.id)
						.single();
					tenantId = p?.tenantId;
				}
			}

			const { error } = await supabase
				.from("observacoes")
				.insert({
					clienteId: clienteId,
					profileId: profile.id,
					tenantId: tenantId,
					texto: observacao.trim(),
				});

			if (error) throw error;

			await carregarObservacoes(clienteId);
			setNovaObservacao("");
			return true;
		} catch (error: any) {
			console.error("Erro ao adicionar observação:", error);
			alert(`Erro ao adicionar observação: ${error.message || "Tente novamente"}`);
			return false;
		} finally {
			setAdicionandoObservacao(false);
		}
	};

	// Função para eliminar observação
	const eliminarObservacao = async (observacaoId: string) => {
		if (!clienteEditando) return;

		setEliminandoObservacao(true);
		try {
			const { error } = await supabase
				.from("observacoes")
				.delete()
				.eq("id", observacaoId);

			if (error) throw error;

			await carregarObservacoes(clienteEditando.id);
		} catch (error: any) {
			console.error("Erro ao eliminar observação:", error);
			alert(`Erro ao eliminar observação: ${error.message || "Tente novamente"}`);
		} finally {
			setEliminandoObservacao(false);
			setObservacaoParaEliminar(null);
		}
	};

	// Funções para gerir associações gestor ↔ parceiro
	const carregarDadosGerirParceiros = async () => {
		if (!profile) return;
		setCarregandoAssociacoes(true);
		try {
			// Determinar tenantId
			let tenantId = profile.tenantId;
			if (!tenantId) {
				if (profile.role === "tenant") {
					tenantId = profile.id;
				} else {
					const { data: p } = await supabase
						.from("profiles")
						.select("tenantId")
						.eq("id", profile.id)
						.single();
					tenantId = p?.tenantId;
				}
			}
			if (!tenantId) return;

			// Carregar todos os parceiros do tenant
			const { data: parceiros } = await supabase
				.from("profiles")
				.select("id, name, email")
				.eq("role", "parceiro")
				.eq("tenantId", tenantId);
			setTodosParceirosTenant(parceiros || []);

			// Admin: carregar todos os gestores do tenant
			if (profile.role === "tenant") {
				const { data: gestores } = await supabase
					.from("profiles")
					.select("id, name, email")
					.eq("role", "gestor")
					.eq("tenantId", tenantId);
				setGestoresDoTenant(gestores || []);
			}

			// Carregar associações (RLS filtra automaticamente)
			const { data: assocData } = await supabase
				.from("gestor_parceiros")
				.select("*");

			if (assocData && assocData.length > 0) {
				// Resolver nomes via queries separadas
				const gestorIds = [...new Set(assocData.map((a: any) => a.gestor_id))];
				const parceiroIds = [...new Set(assocData.map((a: any) => a.parceiro_id))];
				const allIds = [...new Set([...gestorIds, ...parceiroIds])];

				const { data: profilesData } = await supabase
					.from("profiles")
					.select("id, name")
					.in("id", allIds);

				const nameMap: Record<string, string> = {};
				if (profilesData) {
					for (const p of profilesData) {
						nameMap[p.id] = p.name;
					}
				}

				const assocComNomes = assocData.map((a: any) => ({
					id: a.id,
					gestor_id: a.gestor_id,
					parceiro_id: a.parceiro_id,
					gestor_nome: nameMap[a.gestor_id] || "Gestor",
					parceiro_nome: nameMap[a.parceiro_id] || "Parceiro",
				}));
				setAssociacoes(assocComNomes);
			} else {
				setAssociacoes([]);
			}

			// Gestor: auto-seleccionar o seu ID
			if (profile.role === "gestor") {
				setGestorSelecionadoAssoc(profile.id);
			}
		} catch (error) {
			console.error("Erro ao carregar dados de associações:", error);
		} finally {
			setCarregandoAssociacoes(false);
		}
	};

	const adicionarAssociacao = async () => {
		if (!profile) return;

		const gestorId = profile.role === "gestor" ? profile.id : gestorSelecionadoAssoc;
		if (!gestorId || !parceiroSelecionadoAssoc) {
			alert("Seleccione um gestor e um parceiro");
			return;
		}

		// Verificar duplicata
		const jaExiste = associacoes.some(
			(a) => a.gestor_id === gestorId && a.parceiro_id === parceiroSelecionadoAssoc,
		);
		if (jaExiste) {
			alert("Esta associação já existe");
			return;
		}

		try {
			const { error } = await supabase
				.from("gestor_parceiros")
				.insert({ gestor_id: gestorId, parceiro_id: parceiroSelecionadoAssoc });

			if (error) throw error;

			setParceiroSelecionadoAssoc("");
			await carregarDadosGerirParceiros();

			// Recarregar parceiros para o dropdown "Parceiro Responsável"
			if (profile.role === "gestor") {
				await carregarParceirosDoGestor(profile.id);
			} else if (profile.role === "tenant") {
				await carregarParceirosDoTenant(profile.id);
			}
		} catch (error: any) {
			console.error("Erro ao adicionar associação:", error);
			alert(`Erro ao adicionar associação: ${error.message || "Tente novamente"}`);
		}
	};

	const removerAssociacao = async (associacaoId: string) => {
		if (!confirm("Tem a certeza que pretende remover esta associação?")) return;

		try {
			const { error } = await supabase
				.from("gestor_parceiros")
				.delete()
				.eq("id", associacaoId);

			if (error) throw error;

			await carregarDadosGerirParceiros();

			// Recarregar parceiros para o dropdown "Parceiro Responsável"
			if (profile?.role === "gestor") {
				await carregarParceirosDoGestor(profile.id);
			} else if (profile?.role === "tenant") {
				await carregarParceirosDoTenant(profile!.id);
			}
		} catch (error: any) {
			console.error("Erro ao remover associação:", error);
			alert(`Erro ao remover associação: ${error.message || "Tente novamente"}`);
		}
	};

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

			setUser(session.user as SupabaseUser);

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
						: "Utilizador",
					email: session.user.email ?? "sem-email@exemplo.com",
					role: role,
				};
			}

			if (profileData) {
				setProfile(profileData);
				await loadClientes(profileData.role, profileData.id);
				if (profileData.role === "gestor") {
					await carregarParceirosDoGestor(profileData.id);
				} else if (profileData.role === "tenant") {
					await carregarParceirosDoTenant(profileData.tenantId || profileData.id);
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

	const carregarParceirosDoTenant = async (tenantId: string) => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("id, name, email")
				.eq("role", "parceiro")
				.eq("tenantId", tenantId);

			if (error) {
				console.error("Erro ao carregar parceiros do tenant:", error);
				return;
			}

			setParceirosDoGestor(data || []);
		} catch (err) {
			console.error("Erro ao carregar parceiros do tenant:", err);
			setParceirosDoGestor([]);
		}
	};

	const carregarParceirosDoGestor = async (gestorId: string) => {
		try {
			const { data, error } = await supabase
				.from("gestor_parceiros")
				.select(
					`
          parceiro_id,
          profiles:parceiro_id(id, name, email)
        `,
				)
				.eq("gestor_id", gestorId);

			if (error) {
				console.error("Erro ao carregar parceiros do gestor:", error);
				return;
			}

			if (data && data.length > 0) {
				const parceiros = data.map((p: any) => ({
					id: p.profiles.id,
					name: p.profiles.name,
					email: p.profiles.email,
				}));
				setParceirosDoGestor(parceiros);
			} else {
				setParceirosDoGestor([]);
			}
		} catch (err) {
			console.error("Erro ao carregar parceiros do gestor:", err);
		}
	};

	const loadClientes = async (userRole?: string, userId?: string) => {
		try {

			let query = supabase.from("clientes").select("*");

			if (userRole === "tenant") {
				// Tenant vê TODOS os clientes do SEU tenant
				// Inclui: clientes sem profileId (seus) E clientes com profileId (dos gestores)
				query = query.eq("tenantId", userId);
			} else if (userRole === "gestor") {
				// Gestor vê APENAS clientes que ELE criou (profileId = seu ID)
				query = query.eq("profileId", userId);
			} else if (userRole === "parceiro") {
				// Parceiro vê APENAS clientes onde ele é o responsável
				query = query.eq("responsavelId", userId);
			}

			const { data, error } = await query.order("createdAt", {
				ascending: false,
			});

			if (error) {
				console.error("Erro ao carregar clientes:", error);
				setClientes([]);
				setFilteredClientes([]);
				return;
			}

			const clientesComInfo = await carregarInfosResponsaveis(data || []);
			setClientes(clientesComInfo);
			setFilteredClientes(clientesComInfo);
		} catch (err) {
			console.error("Erro inesperado ao carregar clientes:", err);
			setClientes([]);
			setFilteredClientes([]);
		}
	};

	const _getClienteIdsDoGestor = async (
		gestorId: string,
	): Promise<string[]> => {
		if (!gestorId) {
			console.error("gestorId não fornecido para getClienteIdsDoGestor");
			return [];
		}

		try {
			const { data: parceiros, error } = await supabase
				.from("gestor_parceiros")
				.select("parceiro_id")
				.eq("gestor_id", gestorId);

			if (error) {
				console.error("Erro ao buscar parceiros do gestor:", error);
				return [];
			}

			const parceiroIds = parceiros.map((p) => p.parceiro_id);

			// Adicionar o próprio gestor na lista
			const responsavelIds = [...parceiroIds, gestorId];

			const { data: clientes, error: clientesError } = await supabase
				.from("clientes")
				.select("id")
				.in("responsavelId", responsavelIds);

			if (clientesError) {
				console.error(
					"❌ Erro ao buscar clientes do gestor:",
					clientesError,
				);
				return [];
			}

			return clientes.map((c) => c.id);
		} catch (err) {
			console.error("Erro inesperado em getClienteIdsDoGestor:", err);
			return [];
		}
	};

	const carregarInfosResponsaveis = async (clientes: Cliente[]) => {
		try {
			// 1. Coletar todos os IDs de profiles
			const allProfileIds = new Set<string>();

			clientes.forEach((cliente) => {
				if (cliente.profileId) {
					allProfileIds.add(cliente.profileId);
				}
				if (cliente.responsavelId) {
					allProfileIds.add(cliente.responsavelId);
				}
			});

			// 2. Buscar todos os profiles de uma vez
			const { data: profiles, error } = await supabase
				.from("profiles")
				.select("id, name, role")
				.in("id", Array.from(allProfileIds));

			if (error) {
				console.error("Erro ao buscar profiles:", error);
				return clientes.map((cliente) => ({
					...cliente,
					parceiroNome: "",
					parceiroRole: "",
					gestorNome: "",
					foiAtribuido: false,
				}));
			}

			// Criar mapa para acesso rápido
			const profileMap = new Map();
			profiles?.forEach((profile) => {
				profileMap.set(profile.id, profile);
			});

			// 3. Processar cada cliente
			return clientes.map((cliente) => {
				// Quem CRIOU o cliente
				const criadorProfile = profileMap.get(cliente.profileId);

				// Quem é o RESPONSÁVEL atual
				const responsavelIdAtual =
					cliente.responsavelId || cliente.profileId;
				const responsavelProfile = profileMap.get(responsavelIdAtual);

				// Verificar se foi atribuído
				const foiAtribuido = !!(
					cliente.responsavelId &&
					cliente.responsavelId !== cliente.profileId
				);

				// LÓGICA PARA COLUNA PARCEIRO:
				let parceiroNome = "";
				let parceiroRole = "";

				// Só mostra parceiro se o responsável for um parceiro
				if (responsavelProfile?.role === "parceiro") {
					parceiroNome = responsavelProfile.name;
					parceiroRole = responsavelProfile.role;
				}

				// LÓGICA PARA COLUNA GESTOR:
				let gestorNome = "";
				if (criadorProfile?.role === "gestor") {
					gestorNome = criadorProfile.name;
				}

				return {
					...cliente,
					parceiroNome,
					parceiroRole,
					gestorNome,
					foiAtribuido,
				};
			});
		} catch (error) {
			console.error(
				"❌ Erro inesperado em carregarInfosResponsaveis:",
				error,
			);
			return clientes.map((cliente) => ({
				...cliente,
				parceiroNome: "",
				parceiroRole: "",
				gestorNome: "",
				foiAtribuido: false,
			}));
		}
	};

	const buscarResponsavelNome = async (profileId: string) => {
		if (!profileId) {
			setResponsavelNome("Não associado");
			return;
		}

		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("name")
				.eq("id", profileId)
				.single();

			if (error) {
				setResponsavelNome("Não encontrado");
			} else {
				setResponsavelNome(data?.name || "Nome não disponível");
			}
		} catch (_err) {
			setResponsavelNome("Erro ao buscar");
		}
	};

	useEffect(() => {
		let result = [...clientes];

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			result = result.filter(
				(cliente) =>
					cliente.name?.toLowerCase().includes(term) ||
					cliente.email?.toLowerCase().includes(term) ||
					cliente.telefone?.includes(term) ||
					cliente.nif?.includes(term) ||
					cliente.status?.toLowerCase().includes(term) ||
					cliente.produto?.toLowerCase().includes(term) ||
					cliente.codigoPostal?.includes(term),
			);
		}

		if (selectedStatus !== "all") {
			result = result.filter(
				(cliente) => cliente.status === selectedStatus,
			);
		}

		if (selectedGestor !== "all") {
			result = result.filter(
				(cliente) => cliente.gestorNome === selectedGestor,
			);
		}

		if (selectedParceiro !== "all") {
			result = result.filter(
				(cliente) => cliente.parceiroNome === selectedParceiro,
			);
		}

		if (sortConfig) {
			result.sort((a, b) => {
				const aVal = a[sortConfig.key];
				const bVal = b[sortConfig.key];

				if (aVal == null && bVal == null) {
					return 0;
				}
				if (aVal == null) {
					return sortConfig.direction === "asc" ? 1 : -1;
				}
				if (bVal == null) {
					return sortConfig.direction === "asc" ? -1 : 1;
				}

				// Tratamento especial para datas
				if (sortConfig.key === "dataFimContrato") {
					const aDate = aVal ? new Date(aVal as string).getTime() : 0;
					const bDate = bVal ? new Date(bVal as string).getTime() : 0;

					if (aDate < bDate) {
						return sortConfig.direction === "asc" ? -1 : 1;
					}
					if (aDate > bDate) {
						return sortConfig.direction === "asc" ? 1 : -1;
					}
					return 0;
				}

				// Para outros campos (incluindo nome)
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
		setPage(1);
	}, [
		clientes,
		searchTerm,
		selectedStatus,
		selectedGestor,
		selectedParceiro,
		sortConfig,
	]);

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

	const getSortIndicator = (key: keyof Cliente) => {
		if (!sortConfig || sortConfig.key !== key) {
			return null;
		}
		return sortConfig.direction === "asc" ? " ↑" : " ↓";
	};

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

	const handleOverlayClick = () => {
		setSidebarOpen(false);
	};

	const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
			e.preventDefault();
			setSidebarOpen(false);
		}
	};

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

	const formatarDataFimContrato = (dataFimContrato: string | null) => {
		if (!dataFimContrato) {
			return "-";
		}
		return new Date(dataFimContrato).toLocaleDateString("pt-PT");
	};

	const handleVerDetalhes = (cliente: Cliente) => {
		setSelectedCliente(cliente);
		setModalDetalhesOpen(true);
	};

	const handleEditar = async (cliente: Cliente) => {
		setClienteEditando({
			...cliente,
			// Garantir que dataFimContrato seja formatado para input type="date"
			dataFimContrato: formatDateForInput(cliente.dataFimContrato),
		});

		// Carregar parceiros para gestor ou tenant
		if (profile?.role === "gestor") {
			await carregarParceirosDoGestor(profile.id);
		} else if (profile?.role === "tenant") {
			await carregarParceirosDoTenant(profile.tenantId || profile.id);
		}

		// Se o cliente já tem um parceiro, selecioná-lo
		if (
			(profile?.role === "gestor" || profile?.role === "tenant") &&
			cliente.responsavelId
		) {
			setParceiroSelecionadoEdicao(cliente.responsavelId);
		} else {
			setParceiroSelecionadoEdicao("");
		}

		// Carregar observações para o modal de edição
		if (profile?.role !== "parceiro") {
			await carregarObservacoes(cliente.id);
		}

		setModalEditarOpen(true);
	};

	const handleAdicionarCliente = async () => {
		setNovoCliente({
			name: "",
			email: "",
			telefone: "",
			nif: "",
			codigoPostal: "",
			endereco: "",
			status: "em análise",
			produto: "",
			dataFimContrato: "",
		});
		setParceiroSelecionado("");

		// Recarregar parceiros para garantir que a lista está actualizada
		if (profile?.role === "gestor") {
			await carregarParceirosDoGestor(profile.id);
		} else if (profile?.role === "tenant") {
			await carregarParceirosDoTenant(profile.tenantId || profile.id);
		}

		setModalAdicionarOpen(true);
	};

	const handleSalvarEdicao = async () => {
		if (!clienteEditando || !profile) {
			return;
		}

		setEditandoLoading(true);

		try {
			// Preparar dados para atualização
			const dadosAtualizacao: any = {
				name: clienteEditando.name,
				email: clienteEditando.email,
				telefone: clienteEditando.telefone,
				nif: clienteEditando.nif,
				codigoPostal: clienteEditando.codigoPostal,
				endereco: clienteEditando.endereco,
				status: clienteEditando.status,
				produto: clienteEditando.produto,
				updatedAt: new Date().toISOString(),
				// ← ADICIONADO AQUI:
				dataFimContrato: clienteEditando.dataFimContrato || null,
			};

			// Gestor ou tenant podem alterar o responsavelId
			if (
				profile.role === "tenant" ||
				(profile.role === "gestor" &&
					clienteEditando.profileId === profile.id)
			) {
				if (parceiroSelecionadoEdicao) {
					const parceiroValido = parceirosDoGestor.find(
						(p) => p.id === parceiroSelecionadoEdicao,
					);

					if (!parceiroValido) {
						alert("Este parceiro não está disponível");
						setEditandoLoading(false);
						return;
					}

					dadosAtualizacao.responsavelId = parceiroSelecionadoEdicao;
				} else {
					// "Sem parceiro" — grava NULL
					dadosAtualizacao.responsavelId = null;
				}
			}

			const { error } = await supabase
				.from("clientes")
				.update(dadosAtualizacao)
				.eq("id", clienteEditando.id);

			if (error) {
				throw error;
			}

			await loadClientes(profile.role, profile.id);
			setModalEditarOpen(false);
			setClienteEditando(null);
			setParceiroSelecionadoEdicao("");
			alert("Cliente atualizado com sucesso!");
		} catch (err: any) {
			console.error("Erro ao atualizar:", err);
			alert(
				`Erro ao atualizar cliente: ${err.message || "Tente novamente"}`,
			);
		} finally {
			setEditandoLoading(false);
		}
	};

	const handleSalvarNovoCliente = async () => {
		if (!profile) {
			alert("Erro: Perfil não carregado");
			return;
		}

		setAdicionandoLoading(true);

		try {
			// VALIDAÇÕES BASEADAS NA ROLE
			if (profile.role === "parceiro") {
				alert("Parceiros não podem criar clientes");
				setAdicionandoLoading(false);
				return;
			}

			// DADOS BASE PARA O CLIENTE
			const dadosCliente: any = {
				id: crypto.randomUUID(),
				name: novoCliente.name,
				email: novoCliente.email,
				telefone: novoCliente.telefone || "",
				nif: novoCliente.nif || "",
				codigoPostal: novoCliente.codigoPostal || "",
				endereco: novoCliente.endereco || "",
				status: novoCliente.status,
				produto: novoCliente.produto,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				// ← ADICIONADO AQUI:
				dataFimContrato: novoCliente.dataFimContrato || null,
			};

			// LÓGICA BASEADA NA ROLE DO USUÁRIO
			if (profile.role === "tenant") {
				// TENANT cria cliente
				dadosCliente.profileId = null;
				dadosCliente.tenantId = profile.id; // Tenant é seu próprio tenant

				// Se selecionou um parceiro para atribuir
				if (parceiroSelecionado) {
					const parceiroValido = parceirosDoGestor.find(
						(p) => p.id === parceiroSelecionado,
					);

					if (parceiroValido) {
						dadosCliente.responsavelId = parceiroSelecionado;
					} else {
						alert("Este parceiro não está disponível");
						setAdicionandoLoading(false);
						return;
					}
				} else {
					dadosCliente.responsavelId = null; // Gerir pessoalmente
				}
			} else if (profile.role === "gestor") {
				// GESTOR sempre é o profileId
				dadosCliente.profileId = profile.id;

				// Pega tenantId do gestor
				const { data: gestorProfile } = await supabase
					.from("profiles")
					.select("tenantId")
					.eq("id", profile.id)
					.single();

				if (!gestorProfile?.tenantId) {
					alert("Gestor sem empresa associada");
					setAdicionandoLoading(false);
					return;
				}

				dadosCliente.tenantId = gestorProfile.tenantId;

				// Se selecionou um parceiro para atribuir
				if (parceiroSelecionado) {
					const parceiroValido = parceirosDoGestor.find(
						(p) => p.id === parceiroSelecionado,
					);

					if (parceiroValido) {
						dadosCliente.responsavelId = parceiroSelecionado;
					} else {
						alert("Este parceiro não está associado a si");
						setAdicionandoLoading(false);
						return;
					}
				} else {
					// Gestor mantém a responsabilidade
					dadosCliente.responsavelId = null;
				}
			}

			// VALIDAÇÃO FINAL
			if (!dadosCliente.tenantId) {
				alert("Erro: Não foi possível determinar a empresa do cliente");
				setAdicionandoLoading(false);
				return;
			}

			// INSERE NO BANCO
			const { error } = await supabase
				.from("clientes")
				.insert(dadosCliente)
				.select()
				.single();

			if (error) {
				throw error;
			}

			// Se houver observação, adiciona
			if (novaObservacao.trim()) {
				await adicionarObservacao(dadosCliente.id, novaObservacao);
			}

			// RECARREGA E LIMPA
			await loadClientes(profile.role, profile.id);
			setModalAdicionarOpen(false);
			setNovoCliente({
				name: "",
				email: "",
				telefone: "",
				nif: "",
				codigoPostal: "",
				endereco: "",
				status: "em análise",
				produto: "",
				dataFimContrato: "",
			});
			setParceiroSelecionado("");
			setNovaObservacao("");
			alert("Cliente criado com sucesso!");
		} catch (err: any) {
			console.error("Erro ao criar cliente:", err);
			alert(`Erro ao criar cliente: ${err.message || "Tente novamente"}`);
		} finally {
			setAdicionandoLoading(false);
		}
	};

	const handleCriarParceiro = async () => {
		if (!profile || profile.role !== "tenant") return;

		if (!novoParceiro.name || !novoParceiro.email || !novoParceiro.password) {
			alert("Nome, email e palavra-passe são obrigatórios");
			return;
		}

		if (novoParceiro.password.length < 6) {
			alert("A palavra-passe deve ter pelo menos 6 caracteres");
			return;
		}

		setCriandoParceiro(true);

		try {
			const response = await fetch("/api/auth/create-parceiro", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(novoParceiro),
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || "Erro ao criar parceiro");
			}

			// Recarregar lista de parceiros
			await carregarParceirosDoTenant(profile.id);

			setModalAdicionarParceiroOpen(false);
			setNovoParceiro({
				name: "",
				email: "",
				password: "",
				telefone: "",
				endereco: "",
				localidade: "",
				codigoPostal: "",
			});
			alert("Parceiro criado com sucesso!");
		} catch (err: any) {
			console.error("Erro ao criar parceiro:", err);
			alert(err.message || "Erro ao criar parceiro. Tente novamente.");
		} finally {
			setCriandoParceiro(false);
		}
	};

	const handleDeletar = async (clienteId: string, clienteNome: string) => {
		if (
			!confirm(
				`Tem a certeza que deseja eliminar o cliente "${clienteNome}"? Esta ação não pode ser revertida.`,
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
				throw error;
			}

			if (profile) {
				await loadClientes(profile.role, profile.id);
			}

			alert("Cliente eliminado com sucesso!");
		} catch (_err) {
			alert("Erro ao eliminar cliente");
		}
	};

	const closeModalDetalhes = () => {
		setModalDetalhesOpen(false);
		setSelectedCliente(null);
		setResponsavelNome("");
		setObservacoes([]);
		setNovaObservacao("");
	};

	const closeModalEditar = () => {
		setModalEditarOpen(false);
		setClienteEditando(null);
		setParceiroSelecionadoEdicao("");
	};

	const closeModalAdicionar = () => {
		setModalAdicionarOpen(false);
		setNovoCliente({
			name: "",
			email: "",
			telefone: "",
			nif: "",
			codigoPostal: "",
			endereco: "",
			status: "em análise",
			produto: "",
			dataFimContrato: "",
		});
		setParceiroSelecionado("");
		setNovaObservacao("");
	};

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (modalDetalhesOpen) {
					closeModalDetalhes();
				}
				if (modalEditarOpen) {
					closeModalEditar();
				}
				if (modalAdicionarOpen) {
					closeModalAdicionar();
				}
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [modalDetalhesOpen, modalEditarOpen, modalAdicionarOpen]);

	const handleOverlayKeyDownModal = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
			e.preventDefault();
			if (modalDetalhesOpen) {
				closeModalDetalhes();
			}
			if (modalEditarOpen) {
				closeModalEditar();
			}
			if (modalAdicionarOpen) {
				closeModalAdicionar();
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
			"Parceiro",
			"Gestor",
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
			new Date(cliente.createdAt).toLocaleDateString("pt-PT"),
			cliente.dataFimContrato
				? new Date(cliente.dataFimContrato).toLocaleDateString("pt-PT")
				: "-",
			cliente.parceiroNome || "",
			cliente.gestorNome || "-",
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

	const totalPages = Math.ceil(filteredClientes.length / itemsPerPage);
	const startIndex = (page - 1) * itemsPerPage;
	const endIndex = startIndex + itemsPerPage;
	const paginatedClientes = filteredClientes.slice(startIndex, endIndex);

	// Obter lista única de gestores
	const gestoresUnicos = Array.from(
		new Set(clientes.map((c) => c.gestorNome).filter(Boolean)),
	).sort();

	// Obter lista única de parceiros
	const parceirosUnicos = Array.from(
		new Set(clientes.map((c) => c.parceiroNome).filter(Boolean)),
	).sort();

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

	const podeAdicionarCliente =
		profile.role === "tenant" || profile.role === "gestor";

	return (
		<div className="flex min-h-screen bg-gray-50">
			<nav
				className={`fixed top-0 left-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-40 ${
					expanded ? "w-64" : "w-16"
				} ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
				aria-label="Navegação principal"
			>
				<div className="flex flex-col h-full">
					<div className="p-4 border-b border-gray-200 flex items-center">
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="p-2 rounded-md hover:bg-gray-100"
							aria-label={
								expanded ? "Retrair menu" : "Expandir menu"
							}
						>
							<Menu className="w-5 h-5" />
						</button>

						{expanded && (
							<h2 className="ml-3 font-bold text-lg text-gray-800 truncate">
								Menu Principal
							</h2>
						)}
					</div>

					<div className="flex-1 p-4 space-y-2">
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

			{sidebarOpen && (
				<button
					type="button"
					className="fixed inset-0 bg-black/50 z-30 md:hidden"
					onClick={handleOverlayClick}
					onKeyDown={handleOverlayKeyDown}
					aria-label="Fechar menu"
				/>
			)}

			<div
				className={`flex-1 transition-all duration-300 ${
					expanded ? "md:ml-64" : "md:ml-16"
				}`}
			>
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

						<div className="flex items-center flex-wrap justify-end gap-2">
							{podeAdicionarCliente && (
								<button
									type="button"
									onClick={handleAdicionarCliente}
									className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									<Plus size={18} />
									Adicionar Cliente
								</button>
							)}
							{profile?.role === "tenant" && (
								<button
									type="button"
									onClick={() => setModalAdicionarParceiroOpen(true)}
									className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
								>
									<UserPlus size={18} />
									Adicionar Parceiro
								</button>
							)}
							{(profile?.role === "tenant" || profile?.role === "gestor") && (
								<button
									type="button"
									onClick={() => {
										setModalGerirParceirosOpen(true);
										carregarDadosGerirParceiros();
									}}
									className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
								>
									<Link2 size={18} />
									Gerir Parceiros
								</button>
							)}
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

					<div className="bg-white p-4 rounded-lg shadow border">
						<div className="grid grid-cols-1 md:grid-cols-5 gap-4">
							<div>
								<label
									htmlFor="search-input"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									<Search size={16} className="inline mr-1" />
									Pesquisar cliente
								</label>
								<div className="relative">
									<Search
										className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
										size={20}
										aria-hidden="true"
									/>
									<input
										id="search-input"
										type="text"
										placeholder="Pesquisar cliente (nome, email, telefone, NIF, código postal...)"
										value={searchTerm}
										onChange={(e) =>
											setSearchTerm(e.target.value)
										}
										className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
									/>
								</div>
							</div>

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

							<div>
								<label
									htmlFor="gestor-filter"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Gestor
								</label>
								<select
									id="gestor-filter"
									value={selectedGestor}
									onChange={(e) =>
										setSelectedGestor(e.target.value)
									}
									className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
								>
									<option value="all">
										Todos os gestores
									</option>
									{gestoresUnicos.map((gestor) => (
										<option key={gestor} value={gestor}>
											{gestor}
										</option>
									))}
								</select>
							</div>

							<div>
								<label
									htmlFor="parceiro-filter"
									className="block text-sm font-medium text-gray-700 mb-1"
								>
									Parceiro
								</label>
								<select
									id="parceiro-filter"
									value={selectedParceiro}
									onChange={(e) =>
										setSelectedParceiro(e.target.value)
									}
									className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
								>
									<option value="all">
										Todos os parceiros
									</option>
									{parceirosUnicos.map((parceiro) => (
										<option key={parceiro} value={parceiro}>
											{parceiro}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="flex flex-wrap gap-2 mt-4">
							<button
								type="button"
								onClick={() => setSelectedStatus("all")}
								className={`px-3 py-1 text-sm rounded-full ${
									selectedStatus === "all"
										? "bg-blue-600 text-white"
										: "bg-gray-100 text-gray-700 hover:bg-gray-200"
								}`}
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
										className={`px-3 py-1 text-sm rounded-full ${
											selectedStatus === status
												? "bg-blue-600 text-white"
												: "bg-gray-100 text-gray-700 hover:bg-gray-200"
										}`}
									>
										{status.charAt(0).toUpperCase() +
											status.slice(1)}{" "}
										({count})
									</button>
								);
							})}
						</div>
					</div>

					<div className="bg-white rounded-lg shadow border overflow-hidden">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-gray-200">
								<thead className="bg-gray-50">
									<tr>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() => handleSort("name")}
										>
											Nome{getSortIndicator("name")}
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Email
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Telefone
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											NIF
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Status
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Produto
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Código Postal
										</th>
										<th
											className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
											onClick={() =>
												handleSort("dataFimContrato")
											}
										>
											Data Fim Contrato
											{getSortIndicator(
												"dataFimContrato",
											)}
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Parceiro
										</th>
										<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Gestor
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
												colSpan={11}
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
														{cliente.codigoPostal ||
															"-"}
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
													<div className="font-medium">
														{cliente.parceiroNome ||
															"-"}
													</div>
												</td>
												<td className="px-6 py-4 whitespace-nowrap">
													<div className="text-gray-700 font-medium">
														{cliente.gestorNome ||
															"-"}
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
														{/* Remover opções de editar e excluir para parceiros */}
														{profile.role !==
															"parceiro" && (
															<>
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
																	<Edit
																		size={
																			18
																		}
																	/>
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
																	title="Eliminar"
																	aria-label={`Eliminar cliente ${cliente.name}`}
																>
																	<Trash2
																		size={
																			18
																		}
																	/>
																</button>
															</>
														)}
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>

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
											className={`px-3 py-1 rounded border ${
												page === 1
													? "bg-gray-100 text-gray-400 cursor-not-allowed"
													: "bg-white text-gray-700 hover:bg-gray-50"
											}`}
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
															className={`w-8 h-8 rounded ${
																page === pageNum
																	? "bg-blue-600 text-white"
																	: "bg-white text-gray-700 hover:bg-gray-100 border"
															}`}
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
											className={`px-3 py-1 rounded border ${
												page === totalPages
													? "bg-gray-100 text-gray-400 cursor-not-allowed"
													: "bg-white text-gray-700 hover:bg-gray-50"
											}`}
											aria-label="Próxima página"
										>
											Próxima
										</button>
									</div>
								</div>
							</div>
						)}
					</div>

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
											className={`w-12 h-12 rounded-full flex items-center justify-center ${
												STATUS_COLORS[
													status as keyof typeof STATUS_COLORS
												].split(" ")[0]
											}`}
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

			{modalAdicionarOpen && (
				<>
					<button
						type="button"
						className="fixed inset-0 bg-black/50 z-50 transition-opacity"
						onClick={closeModalAdicionar}
						onKeyDown={handleOverlayKeyDownModal}
						tabIndex={0}
						aria-label="Fechar modal"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
							<div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
								<div className="flex items-center gap-4">
									<div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
										<UserIcon className="w-8 h-8 text-white" />
									</div>
									<div>
										<h2 className="text-2xl font-bold text-gray-900">
											Adicionar Novo Cliente
										</h2>
										<p className="text-gray-600 mt-1">
											Preencha os dados do novo cliente
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={closeModalAdicionar}
									className="p-2 hover:bg-gray-100 rounded-full transition-colors"
									aria-label="Fechar"
								>
									<X className="w-6 h-6 text-gray-500" />
								</button>
							</div>

							<div className="overflow-y-auto max-h-[calc(90vh-180px)]">
								<div className="p-6">
									<form
										onSubmit={(e) => {
											e.preventDefault();
											handleSalvarNovoCliente();
										}}
										className="space-y-6"
									>
										{(profile?.role === "gestor" || profile?.role === "tenant") && (
											<div className="space-y-4">
												<div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
													<h4 className="font-medium text-blue-800 flex items-center gap-2">
														<Users size={16} />
														Parceiro Responsável
														(Opcional)
													</h4>
													<p className="text-sm text-blue-600 mt-1">
														Escolha um parceiro para
														gerir este cliente
														ou deixe em branco para
														gerir pessoalmente
													</p>

													<div className="mt-3">
														<label
															htmlFor="parceiro-select"
															className="block text-sm font-medium text-gray-700 mb-1"
														>
															Selecionar Parceiro
														</label>
														<select
															id="parceiro-select"
															value={
																parceiroSelecionado
															}
															onChange={(e) =>
																setParceiroSelecionado(
																	e.target
																		.value,
																)
															}
															className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
														>
															<option value="">
																Gerir pessoalmente
															</option>
															{parceirosDoGestor.map(
																(parceiro) => (
																	<option
																		key={
																			parceiro.id
																		}
																		value={
																			parceiro.id
																		}
																	>
																		{
																			parceiro.name
																		}{" "}
																		•{" "}
																		{
																			parceiro.email
																		}
																	</option>
																),
															)}
														</select>

														{parceirosDoGestor.length ===
															0 && (
															<p className="text-sm text-gray-500 mt-2">
																Não tem parceiros
																associados.
																{profile?.role === "gestor"
																	? " Contacte o administrador."
																	: " Crie um parceiro primeiro."}
															</p>
														)}
													</div>
												</div>
											</div>
										)}

										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-6">
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<Mail className="w-5 h-5 text-blue-600" />
														Informações de Contacto
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="novo-nome"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Nome Completo *
															</label>
															<input
																id="novo-nome"
																type="text"
																value={
																	novoCliente.name
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			name: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
																placeholder="João Silva"
															/>
														</div>
														<div>
															<label
																htmlFor="novo-email"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Email *
															</label>
															<input
																id="novo-email"
																type="email"
																value={
																	novoCliente.email
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			email: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
																placeholder="joao.silva@exemplo.com"
															/>
														</div>
														<div>
															<label
																htmlFor="novo-telefone"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Telefone
															</label>
															<input
																id="novo-telefone"
																type="tel"
																value={
																	novoCliente.telefone
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			telefone:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="912 345 678"
															/>
														</div>
													</div>
												</div>

												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<FileText className="w-5 h-5 text-purple-600" />
														Documentos
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="novo-nif"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																NIF
															</label>
															<input
																id="novo-nif"
																type="text"
																value={
																	novoCliente.nif
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			nif: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="123456789"
															/>
														</div>
													</div>
												</div>

												{/* Campo para observação inicial */}
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<FileText className="w-5 h-5 text-gray-600" />
														Observação Inicial
														(Opcional)
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="nova-observacao"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Adicionar uma
																observação sobre
																este cliente
															</label>
															<textarea
																id="nova-observacao"
																value={
																	novaObservacao
																}
																onChange={(e) =>
																	setNovaObservacao(
																		e.target
																			.value,
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px]"
																placeholder="Escreva uma observação sobre o cliente..."
																rows={3}
															/>
															<p className="text-xs text-gray-500 mt-1">
																Esta observação
																será registada
																com o seu nome e
																data
															</p>
														</div>
													</div>
												</div>
											</div>

											<div className="space-y-6">
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<MapPin className="w-5 h-5 text-red-600" />
														Endereço
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="novo-endereco"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Endereço
															</label>
															<input
																id="novo-endereco"
																type="text"
																value={
																	novoCliente.endereco
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
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
																htmlFor="novo-codigo-postal"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Código Postal
															</label>
															<input
																id="novo-codigo-postal"
																type="text"
																value={
																	novoCliente.codigoPostal
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			codigoPostal:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																placeholder="1000-001"
															/>
														</div>
													</div>
												</div>

												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<Globe className="w-5 h-5 text-green-600" />
														Informações Comerciais
													</h3>
													<div className="space-y-4">
														<div>
															<label
																htmlFor="novo-produto"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Produto *
															</label>
															<select
																id="novo-produto"
																value={
																	novoCliente.produto
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			produto:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
															>
																<option value="">
																	Selecione um
																	produto
																</option>
																{PRODUTO_OPTIONS.map(
																	(
																		produto,
																	) => (
																		<option
																			key={
																				produto
																			}
																			value={
																				produto
																			}
																		>
																			{produto
																				.charAt(
																					0,
																				)
																				.toUpperCase() +
																				produto.slice(
																					1,
																				)}
																		</option>
																	),
																)}
															</select>
														</div>
														<div>
															<label
																htmlFor="novo-status"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Status *
															</label>
															<select
																id="novo-status"
																value={
																	novoCliente.status
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			status: e
																				.target
																				.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
																required
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
														<div>
															<label
																htmlFor="novo-data-fim-contrato"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																<Calendar className="w-4 h-4 inline mr-1" />
																Data Fim
																Contrato
																(Opcional)
															</label>
															<input
																id="novo-data-fim-contrato"
																type="date"
																value={
																	novoCliente.dataFimContrato ||
																	""
																}
																onChange={(e) =>
																	setNovoCliente(
																		{
																			...novoCliente,
																			// CORREÇÃO DO ERRO AQUI
																			dataFimContrato:
																				e
																					.target
																					.value,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
															/>
															<p className="text-xs text-gray-500 mt-1">
																Use o calendário
																para selecionar
																a data. Formato:
																AAAA-MM-DD
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>

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
														{new Date().toLocaleDateString(
															"pt-PT",
														)}
													</p>
												</div>
												<div className="bg-white p-4 rounded-lg border">
													<p className="text-sm text-gray-500">
														Criado por
													</p>
													<p className="font-medium">
														{profile?.name}
													</p>
													<p className="text-xs text-gray-400 mt-1">
														{profile?.role}
													</p>
												</div>
											</div>
										</div>
									</form>
								</div>
							</div>

							<div className="border-t border-gray-200 p-4 bg-gray-50">
								<div className="flex items-center justify-between">
									<div className="text-sm text-gray-500">
										Os campos marcados com * são
										obrigatórios
									</div>
									<div className="flex items-center gap-3">
										<button
											type="button"
											onClick={closeModalAdicionar}
											className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
											disabled={adicionandoLoading}
										>
											<X size={16} />
											Cancelar
										</button>
										<button
											type="button"
											onClick={handleSalvarNovoCliente}
											disabled={adicionandoLoading}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{adicionandoLoading ? (
												<>
													<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
													A criar...
												</>
											) : (
												<>
													<Plus size={16} />
													Criar Cliente
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

			{modalDetalhesOpen && selectedCliente && (
				<>
					<button
						type="button"
						className="fixed inset-0 bg-black/50 z-50 transition-opacity"
						onClick={closeModalDetalhes}
						onKeyDown={handleOverlayKeyDownModal}
						tabIndex={0}
						aria-label="Fechar modal"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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

							<div className="overflow-y-auto max-h-[calc(90vh-180px)]">
								<div className="p-6">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-6">
											<div className="bg-gray-50 p-4 rounded-xl">
												<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
													<Mail className="w-5 h-5 text-blue-600" />
													Informações de Contacto
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

										<div className="space-y-6">
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

									{/* Observações: visíveis em modo leitura (sem formulário de adicionar) */}
									{profile?.role !== "parceiro" && (
									<div className="mt-8">
										<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
											<FileText className="w-5 h-5 text-gray-600" />
											Observações do Cliente
										</h3>

										{carregandoObservacoes ? (
											<div className="flex items-center justify-center py-8">
												<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
											</div>
										) : observacoes.length > 0 ? (
											<div className="space-y-4 max-h-80 overflow-y-auto pr-2">
												{observacoes.map((obs) => (
													<div
														key={obs.id}
														className="bg-white p-4 rounded-lg border border-gray-200"
													>
														<div className="flex justify-between items-start mb-3">
															<div className="flex items-center gap-2">
																<div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
																	<UserIcon className="w-4 h-4 text-blue-600" />
																</div>
																<div>
																	<p className="font-medium text-gray-800">
																		{obs.profile_nome}
																	</p>
																	<p className="text-xs text-gray-500 capitalize">
																		{obs.profile_role}
																	</p>
																</div>
															</div>
															<span className="text-xs text-gray-500">
																{new Date(obs.createdAt).toLocaleDateString("pt-PT")}
																<br />
																{new Date(obs.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
															</span>
														</div>
														<div className="bg-gray-50 p-3 rounded">
															<p className="text-gray-700 whitespace-pre-wrap">
																{obs.texto}
															</p>
														</div>
													</div>
												))}
											</div>
										) : (
											<div className="bg-gray-50 p-8 rounded-xl border border-gray-200 text-center">
												<div className="text-gray-400 mb-2">
													<FileText className="w-12 h-12 mx-auto" />
												</div>
												<p className="text-lg font-medium text-gray-700">
													Nenhuma observação registada
												</p>
												<p className="text-gray-500 mt-1">
													Edite o cliente para adicionar observações
												</p>
											</div>
										)}
									</div>
									)}

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
														"pt-PT",
													)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(
														selectedCliente.createdAt,
													).toLocaleTimeString(
														"pt-PT",
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
														"pt-PT",
													)}
												</p>
												<p className="text-xs text-gray-400 mt-1">
													{new Date(
														selectedCliente.updatedAt,
													).toLocaleTimeString(
														"pt-PT",
													)}
												</p>
											</div>
											<div className="bg-white p-4 rounded-lg border">
												<p className="text-sm text-gray-500">
													Responsável
												</p>
												<p className="font-medium truncate">
													{responsavelNome ||
														"A carregar..."}
												</p>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div className="border-t border-gray-200 p-4 bg-gray-50">
								<div className="flex items-center justify-between">
									{profile?.role !== "parceiro" && (
										<div className="text-sm text-gray-500">
											Cliente registado há{" "}
											{Math.floor(
												(Date.now() -
													new Date(
														selectedCliente.createdAt,
													).getTime()) /
													(1000 * 60 * 60 * 24),
											)}{" "}
											dias • {observacoes.length} observações
										</div>
									)}
									<div className="flex items-center gap-3">
										{/* Mostrar botões de editar e excluir APENAS para tenant e gestor */}
										{profile?.role !== "parceiro" && (
											<>
												<button
													type="button"
													onClick={() => {
														handleEditar(
															selectedCliente,
														);
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
																`Tem a certeza que deseja eliminar ${selectedCliente.name}?`,
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
													Eliminar
												</button>
											</>
										)}
										{/* Parceiro vê apenas o botão de fechar */}
										{profile?.role === "parceiro" && (
											<button
												type="button"
												onClick={closeModalDetalhes}
												className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
											>
												<X size={16} />
												Fechar
											</button>
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</>
			)}

			{modalEditarOpen && clienteEditando && (
				<>
					<button
						type="button"
						className="fixed inset-0 bg-black/50 z-50 transition-opacity"
						onClick={closeModalEditar}
						onKeyDown={handleOverlayKeyDownModal}
						tabIndex={0}
						aria-label="Fechar modal de edição"
					/>

					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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

							<div className="overflow-y-auto max-h-[calc(90vh-180px)]">
								<div className="p-6">
									<form
										onSubmit={(e) => {
											e.preventDefault();
											handleSalvarEdicao();
										}}
										className="space-y-6"
									>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div className="space-y-6">
												<div className="bg-gray-50 p-4 rounded-xl">
													<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
														<Mail className="w-5 h-5 text-blue-600" />
														Informações de Contacto
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
																placeholder="912 345 678"
															/>
														</div>
													</div>
												</div>

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
																placeholder="123456789"
															/>
														</div>
													</div>
												</div>

												</div>

											<div className="space-y-6">
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
																placeholder="1000-001"
															/>
														</div>
													</div>
												</div>

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
															<select
																id="edit-produto"
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
															>
																<option value="">
																	Selecione um
																	produto
																</option>
																{PRODUTO_OPTIONS.map(
																	(
																		produto,
																	) => (
																		<option
																			key={
																				produto
																			}
																			value={
																				produto
																			}
																		>
																			{produto
																				.charAt(
																					0,
																				)
																				.toUpperCase() +
																				produto.slice(
																					1,
																				)}
																		</option>
																	),
																)}
															</select>
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
														<div>
															<label
																htmlFor="edit-data-fim-contrato"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																<Calendar className="w-4 h-4 inline mr-1" />
																Data Fim
																Contrato
															</label>
															<input
																id="edit-data-fim-contrato"
																type="date"
																value={
																	formatDateForInput(
																		clienteEditando?.dataFimContrato,
																	) || ""
																}
																onChange={(e) =>
																	setClienteEditando(
																		{
																			...clienteEditando,
																			// CORREÇÃO DO ERRO AQUI
																			dataFimContrato:
																				e
																					.target
																					.value ||
																				null,
																		},
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
															/>
															<p className="text-xs text-gray-500 mt-1">
																Deixe em branco
																para remover a
																data. Formato:
																AAAA-MM-DD
															</p>
														</div>
													</div>
												</div>
											</div>
										</div>

										{(profile?.role === "tenant" ||
											(profile?.role === "gestor" &&
												clienteEditando.profileId ===
													profile.id)) && (
												<div className="space-y-4 mt-4">
													<div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
														<h4 className="font-medium text-blue-800 flex items-center gap-2">
															<Users size={16} />
															Parceiro Responsável
														</h4>
														<p className="text-sm text-blue-600 mt-1">
															Atribua um parceiro
															responsável por este
															cliente
														</p>

														<div className="mt-3">
															<label
																htmlFor="parceiro-select-edicao"
																className="block text-sm font-medium text-gray-700 mb-1"
															>
																Parceiro Responsável
															</label>
															<select
																id="parceiro-select-edicao"
																value={
																	parceiroSelecionadoEdicao
																}
																onChange={(e) =>
																	setParceiroSelecionadoEdicao(
																		e.target
																			.value,
																	)
																}
																className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
															>
																<option value="">
																	Sem parceiro
																</option>
																{/* Mostrar parceiro actual mesmo que não esteja na lista de gestor_parceiros */}
																{clienteEditando.responsavelId &&
																	!parceirosDoGestor.some((p) => p.id === clienteEditando.responsavelId) && (
																		<option value={clienteEditando.responsavelId}>
																			{clienteEditando.parceiroNome || "Parceiro actual"} (actual)
																		</option>
																	)}
																{parceirosDoGestor.map(
																	(
																		parceiro,
																	) => (
																		<option
																			key={
																				parceiro.id
																			}
																			value={
																				parceiro.id
																			}
																		>
																			{
																				parceiro.name
																			}{" "}
																			•{" "}
																			{
																				parceiro.email
																			}
																		</option>
																	),
																)}
															</select>

															{clienteEditando.responsavelId && (
																<div className="mt-2 text-sm">
																	<p className="text-gray-600">
																		Atualmente
																		atribuído
																		a:{" "}
																		<span className="font-medium">
																			{parceirosDoGestor.find(
																				(
																					p,
																				) =>
																					p.id ===
																					clienteEditando.responsavelId,
																			)
																				?.name ||
																				"A carregar..."}
																		</span>
																	</p>
																</div>
															)}
														</div>
													</div>
												</div>
											)}

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
															"pt-PT",
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
															"pt-PT",
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

									{/* SEÇÃO DE OBSERVAÇÕES — no modo edição */}
									{profile?.role !== "parceiro" && (
										<div className="mt-6">
											<h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 mb-4">
												<FileText className="w-5 h-5 text-gray-600" />
												Observações do Cliente
											</h3>

											{/* Formulário para adicionar observação */}
											<div className="mb-6">
												<div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
													<label
														htmlFor="nova-observacao-edicao"
														className="block text-sm font-medium text-blue-800 mb-2"
													>
														Adicionar Nova Observação
													</label>
													<textarea
														id="nova-observacao-edicao"
														value={novaObservacao}
														onChange={(e) => setNovaObservacao(e.target.value)}
														className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[80px]"
														placeholder="Escreva a sua observação aqui..."
														rows={3}
													/>
													<div className="flex justify-between items-center mt-3">
														<p className="text-xs text-blue-600">
															Esta observação será registada com o seu nome e data
														</p>
														<button
															type="button"
															onClick={() => {
																if (clienteEditando && novaObservacao.trim()) {
																	adicionarObservacao(clienteEditando.id, novaObservacao);
																}
															}}
															disabled={!novaObservacao.trim() || adicionandoObservacao}
															className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
														>
															{adicionandoObservacao ? (
																<>
																	<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
																	A adicionar...
																</>
															) : (
																<>
																	<Plus size={16} />
																	Adicionar Observação
																</>
															)}
														</button>
													</div>
												</div>
											</div>

											{/* Lista de observações existentes */}
											{carregandoObservacoes ? (
												<div className="flex items-center justify-center py-8">
													<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
												</div>
											) : observacoes.length > 0 ? (
												<div className="space-y-4 max-h-80 overflow-y-auto pr-2">
													{observacoes.map((obs) => (
														<div
															key={obs.id}
															className="bg-white p-4 rounded-lg border border-gray-200"
														>
															<div className="flex justify-between items-start mb-3">
																<div className="flex items-center gap-2">
																	<div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
																		<UserIcon className="w-4 h-4 text-blue-600" />
																	</div>
																	<div>
																		<p className="font-medium text-gray-800">
																			{obs.profile_nome}
																		</p>
																		<p className="text-xs text-gray-500 capitalize">
																			{obs.profile_role}
																		</p>
																	</div>
																</div>
																<div className="flex items-center gap-3">
																	<span className="text-xs text-gray-500 text-right">
																		{new Date(obs.createdAt).toLocaleDateString("pt-PT")}
																		<br />
																		{new Date(obs.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
																	</span>
																	<button
																		type="button"
																		onClick={() => setObservacaoParaEliminar(obs.id)}
																		className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
																		title="Eliminar observação"
																	>
																		<Trash2 size={14} />
																	</button>
																</div>
															</div>
															<div className="bg-gray-50 p-3 rounded">
																<p className="text-gray-700 whitespace-pre-wrap">
																	{obs.texto}
																</p>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
													<div className="text-gray-400 mb-2">
														<FileText className="w-10 h-10 mx-auto" />
													</div>
													<p className="text-gray-700 font-medium">
														Nenhuma observação registada
													</p>
												</div>
											)}

											{/* Modal de confirmação para eliminar observação */}
											{observacaoParaEliminar && (
												<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
													<div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
														<h4 className="text-lg font-semibold text-gray-800 mb-2">
															Eliminar Observação
														</h4>
														<p className="text-gray-600 mb-6">
															Tem a certeza que pretende eliminar esta observação? Esta ação não pode ser revertida.
														</p>
														<div className="flex justify-end gap-3">
															<button
																type="button"
																onClick={() => setObservacaoParaEliminar(null)}
																disabled={eliminandoObservacao}
																className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
															>
																Cancelar
															</button>
															<button
																type="button"
																onClick={() => eliminarObservacao(observacaoParaEliminar)}
																disabled={eliminandoObservacao}
																className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-2 disabled:opacity-50"
															>
																{eliminandoObservacao ? (
																	<>
																		<div className="w-4 h-4 border-2 border-red-700 border-t-transparent rounded-full animate-spin" />
																		A eliminar...
																	</>
																) : (
																	<>
																		<Trash2 size={14} />
																		Eliminar
																	</>
																)}
															</button>
														</div>
													</div>
												</div>
											)}
										</div>
									)}
								</div>
							</div>

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
											onClick={() => handleSalvarEdicao()}
											disabled={editandoLoading}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{editandoLoading ? (
												<>
													<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
													A guardar...
												</>
											) : (
												<>
													<Save size={16} />
													Guardar Alterações
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

			{/* Modal Adicionar Parceiro */}
			{modalAdicionarParceiroOpen && (
				<>
					<div
						className="fixed inset-0 bg-black/50 z-50"
						onClick={() => setModalAdicionarParceiroOpen(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setModalAdicionarParceiroOpen(false);
						}}
						role="button"
						tabIndex={0}
						aria-label="Fechar modal"
					/>
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
										<UserPlus className="w-5 h-5 text-purple-600" />
										Adicionar Parceiro
									</h2>
									<button
										type="button"
										onClick={() => setModalAdicionarParceiroOpen(false)}
										className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
									>
										<X size={20} />
									</button>
								</div>

								<form
									onSubmit={(e) => {
										e.preventDefault();
										handleCriarParceiro();
									}}
									className="space-y-4"
								>
									<div>
										<label
											htmlFor="parceiro-nome"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Nome *
										</label>
										<input
											id="parceiro-nome"
											type="text"
											value={novoParceiro.name}
											onChange={(e) =>
												setNovoParceiro({
													...novoParceiro,
													name: e.target.value,
												})
											}
											className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
											required
											placeholder="Nome do parceiro"
										/>
									</div>

									<div>
										<label
											htmlFor="parceiro-email"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Email *
										</label>
										<input
											id="parceiro-email"
											type="email"
											value={novoParceiro.email}
											onChange={(e) =>
												setNovoParceiro({
													...novoParceiro,
													email: e.target.value,
												})
											}
											className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
											required
											placeholder="parceiro@exemplo.com"
										/>
									</div>

									<div>
										<label
											htmlFor="parceiro-password"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Palavra-passe *
										</label>
										<input
											id="parceiro-password"
											type="password"
											value={novoParceiro.password}
											onChange={(e) =>
												setNovoParceiro({
													...novoParceiro,
													password: e.target.value,
												})
											}
											className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
											required
											minLength={6}
											placeholder="Mínimo 6 caracteres"
										/>
										<p className="text-xs text-gray-500 mt-1">
											O parceiro utilizará esta palavra-passe para fazer login
										</p>
									</div>

									<div>
										<label
											htmlFor="parceiro-telefone"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Telefone
										</label>
										<input
											id="parceiro-telefone"
											type="tel"
											value={novoParceiro.telefone}
											onChange={(e) =>
												setNovoParceiro({
													...novoParceiro,
													telefone: e.target.value,
												})
											}
											className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
											placeholder="+351 900 000 000"
										/>
									</div>

									<div>
										<label
											htmlFor="parceiro-endereco"
											className="block text-sm font-medium text-gray-700 mb-1"
										>
											Endereço
										</label>
										<input
											id="parceiro-endereco"
											type="text"
											value={novoParceiro.endereco}
											onChange={(e) =>
												setNovoParceiro({
													...novoParceiro,
													endereco: e.target.value,
												})
											}
											className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
											placeholder="Rua, número, andar"
										/>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label
												htmlFor="parceiro-localidade"
												className="block text-sm font-medium text-gray-700 mb-1"
											>
												Localidade
											</label>
											<input
												id="parceiro-localidade"
												type="text"
												value={novoParceiro.localidade}
												onChange={(e) =>
													setNovoParceiro({
														...novoParceiro,
														localidade: e.target.value,
													})
												}
												className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
												placeholder="Lisboa"
											/>
										</div>

										<div>
											<label
												htmlFor="parceiro-codigo-postal"
												className="block text-sm font-medium text-gray-700 mb-1"
											>
												Código Postal
											</label>
											<input
												id="parceiro-codigo-postal"
												type="text"
												value={novoParceiro.codigoPostal}
												onChange={(e) =>
													setNovoParceiro({
														...novoParceiro,
														codigoPostal: e.target.value,
													})
												}
												className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
												placeholder="1000-001"
											/>
										</div>
									</div>

									<div className="flex justify-end gap-3 pt-4 border-t">
										<button
											type="button"
											onClick={() => setModalAdicionarParceiroOpen(false)}
											className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
										>
											Cancelar
										</button>
										<button
											type="submit"
											disabled={criandoParceiro}
											className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											{criandoParceiro ? (
												<>
													<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
													A criar...
												</>
											) : (
												<>
													<UserPlus size={16} />
													Criar Parceiro
												</>
											)}
										</button>
									</div>
								</form>
							</div>
						</div>
					</div>
				</>
			)}

			{/* Modal Gerir Parceiros (associações gestor ↔ parceiro) */}
			{modalGerirParceirosOpen && (
				<>
					<div
						className="fixed inset-0 bg-black/50 z-50"
						onClick={() => setModalGerirParceirosOpen(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setModalGerirParceirosOpen(false);
						}}
						role="button"
						tabIndex={0}
						aria-label="Fechar modal"
					/>
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
										<Link2 className="w-5 h-5 text-indigo-600" />
										Gerir Associações de Parceiros
									</h2>
									<button
										type="button"
										onClick={() => setModalGerirParceirosOpen(false)}
										className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
									>
										<X size={20} />
									</button>
								</div>

								{carregandoAssociacoes ? (
									<div className="flex items-center justify-center py-12">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
									</div>
								) : (
									<>
										{/* Formulário para adicionar associação */}
										<div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 mb-6">
											<h3 className="text-sm font-semibold text-indigo-800 mb-3">
												Adicionar Associação
											</h3>
											<div className="flex flex-col sm:flex-row gap-3">
												{/* Dropdown Gestor */}
												{profile?.role === "tenant" ? (
													<div className="flex-1">
														<label htmlFor="assoc-gestor" className="block text-xs font-medium text-gray-600 mb-1">
															Gestor
														</label>
														<select
															id="assoc-gestor"
															value={gestorSelecionadoAssoc}
															onChange={(e) => {
																setGestorSelecionadoAssoc(e.target.value);
																setParceiroSelecionadoAssoc("");
															}}
															className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
														>
															<option value="">Seleccionar gestor...</option>
															{gestoresDoTenant.map((g) => (
																<option key={g.id} value={g.id}>
																	{g.name} ({g.email})
																</option>
															))}
														</select>
													</div>
												) : (
													<div className="flex-1">
														<label className="block text-xs font-medium text-gray-600 mb-1">
															Gestor
														</label>
														<div className="px-3 py-2 bg-gray-100 border rounded-lg text-sm text-gray-700">
															{profile?.name} (você)
														</div>
													</div>
												)}

												{/* Dropdown Parceiro (filtrado) */}
												<div className="flex-1">
													<label htmlFor="assoc-parceiro" className="block text-xs font-medium text-gray-600 mb-1">
														Parceiro
													</label>
													<select
														id="assoc-parceiro"
														value={parceiroSelecionadoAssoc}
														onChange={(e) => setParceiroSelecionadoAssoc(e.target.value)}
														disabled={!gestorSelecionadoAssoc && profile?.role === "tenant"}
														className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
													>
														<option value="">Seleccionar parceiro...</option>
														{todosParceirosTenant
															.filter((p) => {
																const gestorId = profile?.role === "gestor" ? profile.id : gestorSelecionadoAssoc;
																return !associacoes.some(
																	(a) => a.gestor_id === gestorId && a.parceiro_id === p.id,
																);
															})
															.map((p) => (
																<option key={p.id} value={p.id}>
																	{p.name} ({p.email})
																</option>
															))}
													</select>
												</div>

												{/* Botão Associar */}
												<div className="flex items-end">
													<button
														type="button"
														onClick={adicionarAssociacao}
														disabled={
															!parceiroSelecionadoAssoc ||
															(profile?.role === "tenant" && !gestorSelecionadoAssoc)
														}
														className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
													>
														<Plus size={14} />
														Associar
													</button>
												</div>
											</div>
										</div>

										{/* Lista de associações existentes */}
										<div>
											<h3 className="text-sm font-semibold text-gray-700 mb-3">
												Associações Actuais ({associacoes.length})
											</h3>

											{associacoes.length > 0 ? (
												<div className="space-y-2 max-h-80 overflow-y-auto">
													{associacoes.map((assoc) => (
														<div
															key={assoc.id}
															className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
														>
															<div className="flex items-center gap-3">
																<div className="flex items-center gap-2">
																	<div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
																		<UserIcon className="w-3.5 h-3.5 text-blue-600" />
																	</div>
																	<span className="text-sm font-medium text-gray-800">
																		{assoc.gestor_nome}
																	</span>
																</div>
																<ChevronRight size={14} className="text-gray-400" />
																<div className="flex items-center gap-2">
																	<div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center">
																		<UserIcon className="w-3.5 h-3.5 text-purple-600" />
																	</div>
																	<span className="text-sm text-gray-700">
																		{assoc.parceiro_nome}
																	</span>
																</div>
															</div>
															<button
																type="button"
																onClick={() => removerAssociacao(assoc.id)}
																className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
																title="Remover associação"
															>
																<Trash2 size={14} />
															</button>
														</div>
													))}
												</div>
											) : (
												<div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
													<div className="text-gray-400 mb-2">
														<Link2 className="w-10 h-10 mx-auto" />
													</div>
													<p className="text-gray-700 font-medium">
														Nenhuma associação registada
													</p>
													<p className="text-sm text-gray-500 mt-1">
														Associe parceiros a gestores para que possam atribuí-los aos seus clientes
													</p>
												</div>
											)}
										</div>
									</>
								)}

								{/* Footer */}
								<div className="flex justify-end pt-4 mt-6 border-t">
									<button
										type="button"
										onClick={() => setModalGerirParceirosOpen(false)}
										className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
									>
										Fechar
									</button>
								</div>
							</div>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
