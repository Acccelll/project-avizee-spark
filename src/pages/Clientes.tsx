import { useEffect, useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { DataTable } from "@/components/DataTable";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { StatusBadge } from "@/components/StatusBadge";
import { ModulePage } from "@/components/ModulePage";
import { FormModal } from "@/components/FormModal";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { useViaCep } from "@/hooks/useViaCep";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { useDocumentoUnico } from "@/hooks/useDocumentoUnico";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
  Building2, Search, User2, Phone, CreditCard, MapPin, Truck, FileText,
  Info, Loader2, Calendar, Mail, Star, Users, UserCheck,
  Plus, Trash2, MessageSquare, Clock, CheckCircle, Home,
} from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { clienteFornecedorSchema, validateForm } from "@/lib/validationSchemas";

interface Cliente {
  id: string;tipo_pessoa: string;nome_razao_social: string;nome_fantasia: string;
  cpf_cnpj: string;inscricao_estadual: string;email: string;telefone: string;celular: string;
  contato: string;prazo_padrao: number;limite_credito: number;
  forma_pagamento_padrao: string | null;prazo_preferencial: number | null;
  logradouro: string;numero: string;complemento: string;bairro: string;cidade: string;
  uf: string;cep: string;pais: string;observacoes: string;ativo: boolean;created_at: string;
  grupo_economico_id: string | null;tipo_relacao_grupo: string | null;caixa_postal: string | null;
}

interface GrupoEconomico {id: string;nome: string;}
interface FormaPagamentoBasic {id: string;descricao: string;}

interface ClienteTransportadoraRow {
  id: string;
  transportadora_id: string;
  transportadoras?: { nome_razao_social: string } | null;
  prioridade: number | null;
  modalidade: string | null;
  prazo_medio: string | null;
}

interface TransportadoraBasic { id: string; nome_razao_social: string; }

interface EnderecoEntrega {
  id: string;
  cliente_id: string;
  identificacao: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  contato: string | null;
  telefone: string | null;
  principal: boolean;
  ativo: boolean;
  observacoes: string | null;
}

type EnderecoFormData = Omit<EnderecoEntrega, "id" | "cliente_id">;

const emptyEnderecoForm: EnderecoFormData = {
  identificacao: "Endereço de Entrega",
  logradouro: "", numero: "", complemento: "", bairro: "",
  cidade: "", uf: "", cep: "", contato: "", telefone: "",
  principal: false, ativo: true, observacoes: "",
};

interface ComunicacaoCliente {
  id: string;
  cliente_id: string;
  tipo: string | null;
  assunto: string | null;
  conteudo: string | null;
  data_registro: string;
  data_hora: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  retorno_previsto: string | null;
  status: string;
}

type ComunicacaoFormData = {
  tipo: string;
  assunto: string;
  conteudo: string;
  responsavel_nome: string;
  retorno_previsto: string;
  status: string;
};

const emptyComunicacaoForm: ComunicacaoFormData = {
  tipo: "ligacao", assunto: "", conteudo: "", responsavel_nome: "", retorno_previsto: "", status: "registrado",
};

const COMUNICACAO_TIPO_LABEL: Record<string, string> = {
  ligacao: "Ligação", email: "E-mail", reuniao: "Reunião",
  whatsapp: "WhatsApp", visita: "Visita", proposta: "Proposta", outros: "Outros",
};

const COMUNICACAO_STATUS_LABEL: Record<string, string> = {
  registrado: "Registrado", em_andamento: "Em andamento",
  aguardando_retorno: "Aguardando retorno", concluido: "Concluído", cancelado: "Cancelado",
};

interface ClienteFormData {
  tipo_pessoa: string;
  nome_razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  email: string;
  telefone: string;
  celular: string;
  contato: string;
  prazo_padrao: number;
  limite_credito: number;
  forma_pagamento_padrao: string;
  prazo_preferencial: number;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  pais: string;
  observacoes: string;
  grupo_economico_id: string;
  tipo_relacao_grupo: string;
  caixa_postal: string;
}

const emptyCliente: ClienteFormData = {
  tipo_pessoa: "J", nome_razao_social: "", nome_fantasia: "", cpf_cnpj: "",
  inscricao_estadual: "", email: "", telefone: "", celular: "", contato: "",
  prazo_padrao: 30, limite_credito: 0, forma_pagamento_padrao: "", prazo_preferencial: 0,
  logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "", pais: "Brasil",
  observacoes: "", grupo_economico_id: "", tipo_relacao_grupo: "independente", caixa_postal: ""
};

const relacaoOptions = [
{ value: "independente", label: "Independente" },
{ value: "matriz", label: "Matriz" },
{ value: "filial", label: "Filial" },
{ value: "coligada", label: "Coligada" }];

const MAX_PAYMENT_DAYS = 365;
const MAX_OBSERVACOES_LENGTH = 2000;


const Clientes = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data, loading, create, update, remove, duplicate, fetchData } = useSupabaseCrud<Cliente>({
    table: "clientes",
    searchTerm: debouncedSearch,
    searchColumns: ["nome_razao_social", "nome_fantasia", "cpf_cnpj", "email", "cidade"],
  });
  const { pushView } = useRelationalNavigation();
  const { buscarCep, loading: cepLoading } = useViaCep();
  const { buscarCnpj, loading: cnpjLoading } = useCnpjLookup();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Cliente | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<ClienteFormData>(emptyCliente);
  const docTipo = form.tipo_pessoa === "F" ? "cpf" : "cnpj";
  const { isUnique: docUnico, isLoading: docChecking } = useDocumentoUnico(
    docTipo,
    form.cpf_cnpj,
    selected?.id,
  );
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [grupos, setGrupos] = useState<GrupoEconomico[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamentoBasic[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);
  const [grupoFilters, setGrupoFilters] = useState<string[]>([]);
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [modalTransportadoras, setModalTransportadoras] = useState<Array<{
    id: string; transportadora_id: string; transportadora_nome: string;
    prioridade: number | null; modalidade: string | null; prazo_medio: string | null;
  }>>([]);
  const [loadingTransportadoras, setLoadingTransportadoras] = useState(false);
  const [transportadorasList, setTransportadorasList] = useState<TransportadoraBasic[]>([]);
  const [vinculoTranspId, setVinculoTranspId] = useState("");
  const [vinculoTranspPrioridade, setVinculoTranspPrioridade] = useState<number>(1);
  const [savingVinculo, setSavingVinculo] = useState(false);

  // Delivery addresses
  const [enderecos, setEnderecos] = useState<EnderecoEntrega[]>([]);
  const [loadingEnderecos, setLoadingEnderecos] = useState(false);
  const [enderecoDialogOpen, setEnderecoDialogOpen] = useState(false);
  const [enderecoEditId, setEnderecoEditId] = useState<string | null>(null);
  const [enderecoForm, setEnderecoForm] = useState<EnderecoFormData>({ ...emptyEnderecoForm });
  const [savingEndereco, setSavingEndereco] = useState(false);
  const { buscarCep: buscarCepEndereco, loading: cepEnderecoLoading } = useViaCep();

  // Communications
  const [comunicacoes, setComunicacoes] = useState<ComunicacaoCliente[]>([]);
  const [loadingComunicacoes, setLoadingComunicacoes] = useState(false);
  const [comunicacaoDialogOpen, setComunicacaoDialogOpen] = useState(false);
  const [comunicacaoForm, setComunicacaoForm] = useState<ComunicacaoFormData>({ ...emptyComunicacaoForm });
  const [savingComunicacao, setSavingComunicacao] = useState(false);

  const loadTransportadoras = async (clienteId: string) => {
    setLoadingTransportadoras(true);
    try {
      const { data, error } = await supabase
        .from("cliente_transportadoras")
        .select("id, transportadora_id, prioridade, modalidade, prazo_medio, transportadoras(nome_razao_social)")
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .order("prioridade");
      if (error) throw error;
      setModalTransportadoras(((data || []) as ClienteTransportadoraRow[]).map((ct) => ({
        id: ct.id,
        transportadora_id: ct.transportadora_id,
        transportadora_nome: ct.transportadoras?.nome_razao_social || "—",
        prioridade: ct.prioridade,
        modalidade: ct.modalidade,
        prazo_medio: ct.prazo_medio,
      })));
    } catch (err) {
      console.error("[clientes] erro ao carregar transportadoras:", err);
    } finally {
      setLoadingTransportadoras(false);
    }
  };

  const loadEnderecos = async (clienteId: string) => {
    setLoadingEnderecos(true);
    try {
      const { data, error } = await (supabase as any)
        .from("clientes_enderecos_entrega")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("ativo", true)
        .order("principal", { ascending: false });
      if (error) throw error;
      setEnderecos((data || []) as EnderecoEntrega[]);
    } catch (err) {
      console.error("[clientes] erro ao carregar endereços:", err);
    } finally {
      setLoadingEnderecos(false);
    }
  };

  const loadComunicacoes = async (clienteId: string) => {
    setLoadingComunicacoes(true);
    try {
      const { data, error } = await supabase
        .from("cliente_registros_comunicacao")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("data_registro", { ascending: false })
        .limit(50);
      if (error) throw error;
      setComunicacoes((data || []) as unknown as ComunicacaoCliente[]);
    } catch (err) {
      console.error("[clientes] erro ao carregar comunicações:", err);
    } finally {
      setLoadingComunicacoes(false);
    }
  };

  const handleAddTransportadora = async (clienteId: string) => {
    if (!vinculoTranspId) { toast.error("Selecione uma transportadora"); return; }
    const already = modalTransportadoras.some(t => t.transportadora_id === vinculoTranspId);
    if (already) { toast.error("Transportadora já vinculada"); return; }
    setSavingVinculo(true);
    try {
      const { error } = await supabase.from("cliente_transportadoras").insert({
        cliente_id: clienteId, transportadora_id: vinculoTranspId,
        prioridade: vinculoTranspPrioridade, ativo: true,
      });
      if (error) throw error;
      setVinculoTranspId("");
      setVinculoTranspPrioridade(modalTransportadoras.length + 2);
      await loadTransportadoras(clienteId);
      toast.success("Transportadora vinculada");
    } catch (err) {
      console.error("[clientes] erro ao vincular transportadora:", err);
      toast.error("Erro ao vincular transportadora");
    }
    setSavingVinculo(false);
  };

  const handleRemoveTransportadora = async (vinculoId: string, clienteId: string) => {
    try {
      const { error } = await supabase.from("cliente_transportadoras").update({ ativo: false }).eq("id", vinculoId);
      if (error) throw error;
      await loadTransportadoras(clienteId);
      toast.success("Vínculo removido");
    } catch (err) {
      console.error("[clientes] erro ao remover vínculo:", err);
      toast.error("Erro ao remover vínculo");
    }
  };

  const handleSaveEndereco = async (clienteId: string) => {
    if (!enderecoForm.identificacao.trim()) { toast.error("Identificação do endereço é obrigatória"); return; }
    setSavingEndereco(true);
    try {
      const payload = { ...enderecoForm, cliente_id: clienteId };
      if (enderecoEditId) {
        // When editing, if marking as principal, unset others first
        if (enderecoForm.principal) {
          await (supabase as any)
            .from("clientes_enderecos_entrega")
            .update({ principal: false })
            .eq("cliente_id", clienteId)
            .neq("id", enderecoEditId);
        }
        const { error } = await (supabase as any).from("clientes_enderecos_entrega").update(enderecoForm).eq("id", enderecoEditId);
        if (error) throw error;
        toast.success("Endereço atualizado");
      } else {
        // If principal, unset other principals
        if (enderecoForm.principal) {
          await (supabase as any).from("clientes_enderecos_entrega").update({ principal: false }).eq("cliente_id", clienteId);
        }
        const { error } = await (supabase as any).from("clientes_enderecos_entrega").insert(payload);
        if (error) throw error;
        toast.success("Endereço de entrega adicionado");
      }
      setEnderecoDialogOpen(false);
      setEnderecoEditId(null);
      await loadEnderecos(clienteId);
    } catch (err) {
      console.error("[clientes] erro ao salvar endereço:", err);
      toast.error("Erro ao salvar endereço");
    }
    setSavingEndereco(false);
  };

  const handleSetPrincipalEndereco = async (enderecoId: string, clienteId: string) => {
    try {
      await (supabase as any).from("clientes_enderecos_entrega").update({ principal: false }).eq("cliente_id", clienteId);
      await (supabase as any).from("clientes_enderecos_entrega").update({ principal: true }).eq("id", enderecoId);
      await loadEnderecos(clienteId);
      toast.success("Endereço principal definido");
    } catch (err) {
      console.error("[clientes] erro ao definir principal:", err);
      toast.error("Erro ao definir endereço principal");
    }
  };

  const handleRemoveEndereco = async (enderecoId: string, clienteId: string) => {
    try {
      await (supabase as any).from("clientes_enderecos_entrega").update({ ativo: false }).eq("id", enderecoId);
      await loadEnderecos(clienteId);
      toast.success("Endereço removido");
    } catch (err) {
      console.error("[clientes] erro ao remover endereço:", err);
      toast.error("Erro ao remover endereço");
    }
  };

  const handleSaveComunicacao = async (clienteId: string) => {
    if (!comunicacaoForm.assunto.trim()) { toast.error("Assunto é obrigatório"); return; }
    setSavingComunicacao(true);
    try {
      const { error } = await (supabase as any).from("cliente_registros_comunicacao").insert({
        cliente_id: clienteId,
        tipo: comunicacaoForm.tipo,
        assunto: comunicacaoForm.assunto,
        conteudo: comunicacaoForm.conteudo || null,
        responsavel_nome: comunicacaoForm.responsavel_nome || null,
        retorno_previsto: comunicacaoForm.retorno_previsto || null,
        status: comunicacaoForm.status,
        data_registro: new Date().toISOString().split("T")[0],
        data_hora: new Date().toISOString(),
      });
      if (error) throw error;
      setComunicacaoDialogOpen(false);
      setComunicacaoForm({ ...emptyComunicacaoForm });
      await loadComunicacoes(clienteId);
      toast.success("Comunicação registrada");
    } catch (err) {
      console.error("[clientes] erro ao salvar comunicação:", err);
      toast.error("Erro ao salvar comunicação");
    }
    setSavingComunicacao(false);
  };

  useEffect(() => {
    Promise.all([
      supabase.from("grupos_economicos").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("formas_pagamento").select("id, descricao").eq("ativo", true).order("descricao"),
      supabase.from("transportadoras").select("id, nome_razao_social").eq("ativo", true).order("nome_razao_social"),
    ]).then(([{ data: g }, { data: fp }, { data: tr }]) => {
      setGrupos((g as GrupoEconomico[]) || []);
      setFormasPagamento((fp || []) as FormaPagamentoBasic[]);
      setTransportadorasList((tr || []) as TransportadoraBasic[]);
    });
  }, []);

  useEffect(() => {
    const editId = (location.state as { editId?: string } | null)?.editId;
    if (!editId) return;
    navigate(location.pathname, { replace: true, state: {} });
    supabase.from("clientes").select("*").eq("id", editId).maybeSingle().then(({ data: c }) => {
      if (c) openEdit(c as Cliente);
    });
  // openEdit is stable (no deps change); navigate/pathname are stable refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const openCreate = () => {setMode("create");setForm({ ...emptyCliente });setSelected(null);setIsDirty(false);setModalTransportadoras([]);setEnderecos([]);setComunicacoes([]);setModalOpen(true);};
  const openEdit = (c: Cliente) => {
    setMode("edit");setSelected(c);
    setForm({
      tipo_pessoa: c.tipo_pessoa || "J", nome_razao_social: c.nome_razao_social, nome_fantasia: c.nome_fantasia || "",
      cpf_cnpj: c.cpf_cnpj || "", inscricao_estadual: c.inscricao_estadual || "",
      email: c.email || "", telefone: c.telefone || "", celular: c.celular || "", contato: c.contato || "",
      prazo_padrao: c.prazo_padrao || 30, limite_credito: c.limite_credito || 0,
      forma_pagamento_padrao: c.forma_pagamento_padrao || "",
      prazo_preferencial: c.prazo_preferencial || 0,
      logradouro: c.logradouro || "", numero: c.numero || "", complemento: c.complemento || "",
      bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "", cep: c.cep || "",
      pais: c.pais || "Brasil", observacoes: c.observacoes || "",
      grupo_economico_id: c.grupo_economico_id || "", tipo_relacao_grupo: c.tipo_relacao_grupo || "independente",
      caixa_postal: c.caixa_postal || ""
    });
    setIsDirty(false);
    setModalTransportadoras([]);
    setEnderecos([]);
    setComunicacoes([]);
    Promise.all([
      loadTransportadoras(c.id),
      loadEnderecos(c.id),
      loadComunicacoes(c.id),
    ]);
    setModalOpen(true);
  };

  const openView = (c: Cliente) => {
    pushView("cliente", c.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateForm(clienteFornecedorSchema, form);
    if (!validation.success) {
      setFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError || "Corrija os erros do formulário");
      return;
    }
    setFormErrors({});
    setSaving(true);
    const payload = {
      ...form,
      grupo_economico_id: form.grupo_economico_id || null,
      caixa_postal: form.caixa_postal || null,
      forma_pagamento_padrao: form.forma_pagamento_padrao || null,
      prazo_preferencial: form.prazo_preferencial || null,
    };
    try {
      if (mode === "create") await create(payload);else
      if (selected) await update(selected.id, payload);
      setIsDirty(false);
      setModalOpen(false);
    } catch (err) {
      console.error('[clientes] erro ao salvar:', err);
    }
    setSaving(false);
  };

  const grupoNome = (id: string | null) => !id ? "—" : grupos.find((g) => g.id === id)?.nome || "—";
  const relacaoLabel: Record<string, string> = { matriz: "Matriz", filial: "Filial", coligada: "Coligada", independente: "Independente" };
  const updateForm = (updates: Partial<ClienteFormData>) => { setForm(prev => ({ ...prev, ...updates })); setIsDirty(true); };

  const filteredData = useMemo(() => {
    // Text search is now server-side; only apply local dropdown filters
    return data.filter((cliente) => {
      if (tipoFilters.length > 0 && !tipoFilters.includes(cliente.tipo_pessoa)) return false;
      if (grupoFilters.length > 0) {
        const groupId = cliente.grupo_economico_id || "sem_grupo";
        if (!grupoFilters.includes(groupId)) return false;
      }
      if (ativoFilters.length > 0) {
        const status = cliente.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(status)) return false;
      }
      return true;
    });
  }, [data, grupoFilters, tipoFilters, ativoFilters]);

  const columns = [
  {
    key: "nome_razao_social",
      mobilePrimary: true, label: "Nome / Razão Social", sortable: true,
    render: (c: Cliente) => (
      <div>
        <p className="font-medium leading-tight">{c.nome_razao_social}</p>
        {c.nome_fantasia && c.nome_fantasia !== c.nome_razao_social && (
          <p className="text-xs text-muted-foreground truncate max-w-xs">{c.nome_fantasia}</p>
        )}
      </div>
    ),
  },
  {
    key: "cpf_cnpj",
      mobileCard: true, label: "CPF / CNPJ",
    render: (c: Cliente) => <span className="font-mono text-xs">{c.cpf_cnpj || "—"}</span>,
  },
  {
    key: "tipo_pessoa", label: "Tipo",
    render: (c: Cliente) => (
      <span className={`text-xs font-semibold ${c.tipo_pessoa === "F" ? "text-blue-600 dark:text-blue-400" : "text-violet-600 dark:text-violet-400"}`}>
        {c.tipo_pessoa === "F" ? "PF" : "PJ"}
      </span>
    ),
  },
  {
    key: "contato_principal",
      mobileCard: true, label: "Contato",
    render: (c: Cliente) => {
      const phone = c.celular || c.telefone;
      if (!phone && !c.email) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="text-xs space-y-0.5">
          {phone && <p className="font-medium tabular-nums">{phone}</p>}
          {c.email && <p className="text-muted-foreground truncate max-w-xs">{c.email}</p>}
        </div>
      );
    },
  },
  {
    key: "prazo_padrao", label: "Prazo",
    render: (c: Cliente) => c.prazo_padrao
      ? <span className="font-mono text-xs font-medium">{c.prazo_padrao}d</span>
      : <span className="text-muted-foreground text-xs">—</span>,
  },
  {
    key: "grupo", label: "Grupo Econômico",
    render: (c: Cliente) => grupoNome(c.grupo_economico_id),
  },
  { key: "ativo",
      mobileCard: true, label: "Status", render: (c: Cliente) => <StatusBadge status={c.ativo ? "Ativo" : "Inativo"} /> },
  ];


  const cliActiveFilters = useMemo(() => {
    const chips: FilterChip[] = [];

    tipoFilters.forEach(f => {
      chips.push({
        key: "tipo",
        label: "Tipo",
        value: [f],
        displayValue: f === "J" ? "Pessoa Jurídica" : "Pessoa Física"
      });
    });

    grupoFilters.forEach(f => {
      const g = grupos.find(x => x.id === f);
      chips.push({
        key: "grupo",
        label: "Grupo",
        value: [f],
        displayValue: g?.nome || "Sem grupo"
      });
    });

    ativoFilters.forEach(f => {
      chips.push({
        key: "ativo",
        label: "Status",
        value: [f],
        displayValue: f === "ativo" ? "Ativo" : "Inativo"
      });
    });

    return chips;
  }, [tipoFilters, grupoFilters, grupos, ativoFilters]);

  const handleRemoveCliFilter = (key: string, value?: string) => {
    if (key === "tipo") setTipoFilters(prev => prev.filter(v => v !== value));
    if (key === "grupo") setGrupoFilters(prev => prev.filter(v => v !== value));
    if (key === "ativo") setAtivoFilters(prev => prev.filter(v => v !== value));
  };

  const tipoOptions: MultiSelectOption[] = [
    { label: "Pessoa Jurídica", value: "J" },
    { label: "Pessoa Física", value: "F" },
  ];

  const grupoOptions: MultiSelectOption[] = [
    ...grupos.map(g => ({ label: g.nome, value: g.id })),
    { label: "Sem grupo", value: "sem_grupo" }
  ];

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  const summaryAtivos = useMemo(() => data.filter(c => c.ativo).length, [data]);
  const summaryComGrupo = useMemo(() => data.filter(c => c.grupo_economico_id).length, [data]);

  return (
    <AppLayout>
      <ModulePage
        title="Clientes"
        subtitle="Consulta comercial e cadastro de clientes"
        addLabel="Novo Cliente"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total de Clientes" value={String(data.length)} icon={Users} />
            <StatCard title="Ativos" value={String(summaryAtivos)} icon={UserCheck} iconColor="text-success" />
            <StatCard title="Inativos" value={String(data.length - summaryAtivos)} icon={User2} />
            <StatCard title="Com Grupo Econômico" value={String(summaryComGrupo)} icon={Building2} />
          </>
        }
      >
        
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, CNPJ, e-mail ou cidade..."
          activeFilters={cliActiveFilters}
          onRemoveFilter={handleRemoveCliFilter}
          onClearAll={() => { setTipoFilters([]); setGrupoFilters([]); setAtivoFilters([]); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={ativoOptions}
            selected={ativoFilters}
            onChange={setAtivoFilters}
            placeholder="Status"
            className="w-[130px]"
          />
          <MultiSelect
            options={tipoOptions}
            selected={tipoFilters}
            onChange={setTipoFilters}
            placeholder="Tipos"
            className="w-[150px]"
          />
          <MultiSelect
            options={grupoOptions}
            selected={grupoFilters}
            onChange={setGrupoFilters}
            placeholder="Grupos"
            className="w-[200px]"
          />
        </AdvancedFilterBar>

        <PullToRefresh onRefresh={fetchData}>
        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="clientes"
          showColumnToggle={true}
          onView={openView}
          onEdit={openEdit}
          onDelete={(c) => remove(c.id)}
        />
        </PullToRefresh>
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => {
        if (isDirty && !window.confirm("Existem alterações não salvas. Deseja descartar as alterações?")) return;
        setModalOpen(false);
      }} title={mode === "create" ? "Novo Cliente" : "Editar Cliente"} size="xl">
        <form onSubmit={handleSubmit} className="space-y-0">

          {/* Edit-mode context bar */}
          {mode === "edit" && selected && (
            <div className="flex flex-wrap items-center gap-3 bg-muted/40 rounded-lg px-3 py-2 mb-4 text-xs text-muted-foreground border">
              <StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />
              {selected.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Cadastrado em {formatDate(selected.created_at)}
                </span>
              )}
              {form.forma_pagamento_padrao && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {form.forma_pagamento_padrao}
                </span>
              )}
              {form.grupo_economico_id && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {grupos.find(g => g.id === form.grupo_economico_id)?.nome}
                </span>
              )}
              {isDirty && (
                <span className="flex items-center gap-1 text-amber-600 ml-auto font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                  Alterações não salvas
                </span>
              )}
            </div>
          )}

          <Tabs defaultValue="dados-gerais" className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="dados-gerais" className="gap-1.5"><User2 className="h-3.5 w-3.5" />Dados Gerais</TabsTrigger>
              <TabsTrigger value="contatos" className="gap-1.5"><Phone className="h-3.5 w-3.5" />Contatos</TabsTrigger>
              <TabsTrigger value="endereco" className="gap-1.5"><MapPin className="h-3.5 w-3.5" />Endereço</TabsTrigger>
              {mode === "edit" && (
                <TabsTrigger value="entregas" className="gap-1.5">
                  <Home className="h-3.5 w-3.5" />Entregas
                  {enderecos.length > 0 && <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">{enderecos.length}</span>}
                </TabsTrigger>
              )}
              <TabsTrigger value="comercial" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" />Comercial</TabsTrigger>
              <TabsTrigger value="observacoes" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Obs.</TabsTrigger>
            </TabsList>

            {/* ── TAB: DADOS GERAIS ─────────────────────────── */}
            <TabsContent value="dados-gerais" className="space-y-4 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1.5">
              <Label>Tipo de Pessoa</Label>
              <Select value={form.tipo_pessoa} onValueChange={(v) => updateForm({ tipo_pessoa: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">Pessoa Física</SelectItem>
                  <SelectItem value="J">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>CPF/CNPJ</Label>
                {form.tipo_pessoa === "J" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] text-xs">
                      Informe o CNPJ e clique em <strong>Consultar</strong> para preencher automaticamente Razão Social, Nome Fantasia, e-mail, telefone e endereço.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex gap-1">
                <MaskedInput mask="cpf_cnpj" value={form.cpf_cnpj} onChange={(v) => updateForm({ cpf_cnpj: v })} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      disabled={cnpjLoading || form.tipo_pessoa !== "J"}
                      onClick={async () => {
                        const result = await buscarCnpj(form.cpf_cnpj);
                        if (result) {
                           setForm(prev => ({
                            ...prev,
                            nome_razao_social: result.razao_social || prev.nome_razao_social,
                            nome_fantasia: result.nome_fantasia || prev.nome_fantasia,
                            inscricao_estadual: result.inscricao_estadual || prev.inscricao_estadual,
                            email: result.email || prev.email,
                            telefone: result.telefone || prev.telefone,
                            logradouro: result.logradouro || prev.logradouro,
                            numero: result.numero || prev.numero,
                            complemento: result.complemento || prev.complemento,
                            bairro: result.bairro || prev.bairro,
                            cidade: result.municipio || prev.cidade,
                            uf: result.uf || prev.uf,
                            cep: result.cep || prev.cep,
                          }));
                          setIsDirty(true);
                        }
                      }}
                    >
                      {cnpjLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    {form.tipo_pessoa !== "J" ? "Disponível apenas para Pessoa Jurídica" : "Consultar CNPJ e preencher automaticamente"}
                  </TooltipContent>
                </Tooltip>
              </div>
              {formErrors.cpf_cnpj && <p className="text-xs text-destructive">{formErrors.cpf_cnpj}</p>}
              {!formErrors.cpf_cnpj && docChecking && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />Verificando unicidade...
                </p>
              )}
              {!formErrors.cpf_cnpj && !docChecking && docUnico === false && (
                <p className="text-xs text-destructive">CPF/CNPJ já cadastrado em cliente ou fornecedor.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Inscrição Estadual</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">
                    Inscrição Estadual para emissão de notas fiscais. Informe "ISENTO" quando aplicável.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input value={form.inscricao_estadual} onChange={(e) => updateForm({ inscricao_estadual: e.target.value })} placeholder="Ex: 123.456.789.000 ou ISENTO" />
            </div>
            <div className="col-span-2 md:col-span-3 space-y-1.5">
              <Label>Nome / Razão Social <span className="text-destructive">*</span></Label>
              <Input
                value={form.nome_razao_social}
                onChange={(e) => updateForm({ nome_razao_social: e.target.value })}
                required
                placeholder={form.tipo_pessoa === "J" ? "Razão social conforme CNPJ" : "Nome completo"}
                className={formErrors.nome_razao_social ? "border-destructive" : ""}
              />
              {formErrors.nome_razao_social && <p className="text-xs text-destructive">{formErrors.nome_razao_social}</p>}
            </div>
            <div className="col-span-2 md:col-span-3 space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Nome Fantasia</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] text-xs">
                    Nome comercial pelo qual o cliente é conhecido. Aparece nas listagens e relatórios.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input value={form.nome_fantasia} onChange={(e) => updateForm({ nome_fantasia: e.target.value })} placeholder="Nome comercial (opcional)" />
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: CONTATOS ─────────────────────────────── */}
            <TabsContent value="contatos" className="space-y-4 mt-0">
          <div className="mb-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Referência de atendimento</p>
              <div className="space-y-1.5">
                <Label>Pessoa de Contato</Label>
                <Input
                  value={form.contato}
                  onChange={(e) => updateForm({ contato: e.target.value })}
                  placeholder="Nome do responsável pelo contato comercial"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Canais de comunicação</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3 space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label>E-mail</Label>
                  </div>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm({ email: e.target.value })}
                    placeholder="email@empresa.com.br"
                    className={formErrors.email ? "border-destructive" : ""}
                  />
                  {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <MaskedInput mask="telefone" value={form.telefone} onChange={(v) => updateForm({ telefone: v })} />
                  {formErrors.telefone && <p className="text-xs text-destructive">{formErrors.telefone}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Celular / WhatsApp</Label>
                  <MaskedInput mask="celular" value={form.celular} onChange={(v) => updateForm({ celular: v })} />
                  {formErrors.celular && <p className="text-xs text-destructive">{formErrors.celular}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* ── Histórico de Comunicações (apenas modo edição) ── */}
          {mode === "edit" && selected && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary/70" />
                  <h3 className="font-semibold text-sm">Histórico de Comunicações</h3>
                  {comunicacoes.length > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5">{comunicacoes.length}</Badge>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8"
                  onClick={() => { setComunicacaoForm({ ...emptyComunicacaoForm }); setComunicacaoDialogOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Incluir
                </Button>
              </div>
              {loadingComunicacoes ? (
                <div className="h-16 bg-muted/30 rounded-lg animate-pulse" />
              ) : comunicacoes.length === 0 ? (
                <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-3 text-xs text-muted-foreground border border-dashed">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span>Nenhuma comunicação registrada. Clique em <strong>Incluir</strong> para registrar a primeira interação.</span>
                </div>
              ) : (
                <div className="space-y-1 max-h-[260px] overflow-y-auto">
                  {comunicacoes.map((com) => (
                    <div key={com.id} className="flex items-start justify-between py-2 px-2 rounded-md hover:bg-muted/30 border-b last:border-b-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">{com.assunto || "—"}</span>
                          {com.tipo && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {COMUNICACAO_TIPO_LABEL[com.tipo] || com.tipo}
                            </Badge>
                          )}
                        </div>
                        {com.conteudo && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{com.conteudo}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{new Date(com.data_hora || com.data_registro).toLocaleString("pt-BR")}</span>
                          {com.responsavel_nome && <span>· {com.responsavel_nome}</span>}
                          {com.retorno_previsto && (
                            <span className="text-amber-600">· Retorno: {new Date(com.retorno_previsto + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
                          {COMUNICACAO_STATUS_LABEL[com.status] || com.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
            </TabsContent>

            {/* ── TAB: ENDEREÇO ─────────────────────────────── */}
            <TabsContent value="endereco" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Informe o CEP para preenchimento automático do logradouro, bairro, cidade e UF.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <div className="relative">
                <MaskedInput
                  mask="cep"
                  value={form.cep}
                  onChange={(v) => updateForm({ cep: v })}
                  onBlur={async () => {
                    const result = await buscarCep(form.cep);
                    if (result) {
                      setForm(prev => ({ ...prev, logradouro: result.logradouro, bairro: result.bairro, cidade: result.localidade, uf: result.uf }));
                      setIsDirty(true);
                    }
                  }}
                  className={cepLoading ? "pr-8" : ""}
                />
                {cepLoading && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              {formErrors.cep && <p className="text-xs text-destructive">{formErrors.cep}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Logradouro</Label>
              <Input value={form.logradouro} onChange={(e) => updateForm({ logradouro: e.target.value })} placeholder="Rua, Av., Travessa..." />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => updateForm({ numero: e.target.value })} placeholder="Nº ou S/N" />
            </div>
            <div className="space-y-1.5">
              <Label>Complemento</Label>
              <Input value={form.complemento} onChange={(e) => updateForm({ complemento: e.target.value })} placeholder="Sala, bloco, andar..." />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => updateForm({ bairro: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.cidade} onChange={(e) => updateForm({ cidade: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input
                maxLength={2}
                placeholder="SP"
                value={form.uf}
                onChange={(e) => updateForm({ uf: e.target.value.toUpperCase() })}
                className={formErrors.uf ? "border-destructive" : ""}
              />
              {formErrors.uf && <p className="text-xs text-destructive">{formErrors.uf}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input value={form.pais} onChange={(e) => updateForm({ pais: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Caixa Postal</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    Caixa Postal para entrega de correspondências, quando diferente do endereço principal.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input value={form.caixa_postal} onChange={(e) => updateForm({ caixa_postal: e.target.value })} placeholder="Ex: CP 1234" />
            </div>
          </div>
            </TabsContent>

            {/* ── TAB: COMERCIAL ────────────────────────────── */}
            <TabsContent value="comercial" className="space-y-4 mt-0">
          <div className="flex items-center gap-2 pb-1">
            <CreditCard className="w-4 h-4 text-primary/70" />
            <h3 className="font-semibold text-sm">Condições Comerciais</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Condições aplicadas por padrão em orçamentos e pedidos. Podem ser sobrescritas individualmente por operação.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
            <div className="col-span-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Forma de Pagamento Padrão</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Forma de pagamento pré-selecionada ao criar pedidos para este cliente.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={form.forma_pagamento_padrao || "nenhuma"}
                onValueChange={(v) => updateForm({ forma_pagamento_padrao: v === "nenhuma" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Não definida" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhuma">Não definida</SelectItem>
                  {formasPagamento.map((fp) => <SelectItem key={fp.id} value={fp.descricao}>{fp.descricao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Prazo Padrão (dias)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Prazo padrão em dias para pagamento. Aplicado automaticamente em novas operações.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                min={0}
                max={MAX_PAYMENT_DAYS}
                value={form.prazo_padrao}
                onChange={(e) => updateForm({ prazo_padrao: Number(e.target.value) })}
                className={formErrors.prazo_padrao ? "border-destructive" : ""}
              />
              {formErrors.prazo_padrao && <p className="text-xs text-destructive">{formErrors.prazo_padrao}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Prazo Preferencial (dias)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Prazo alternativo negociado com o cliente. Diferente do prazo padrão — usado quando há condição especial acordada.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                min={0}
                max={MAX_PAYMENT_DAYS}
                value={form.prazo_preferencial}
                onChange={(e) => updateForm({ prazo_preferencial: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="mb-4">
            <div className="rounded-md border bg-muted/20 px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Limite de Crédito (R$)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] text-xs">
                    Valor máximo de crédito disponível para este cliente. Impacta a análise de risco no financeiro.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                value={form.limite_credito}
                onChange={(e) => updateForm({ limite_credito: Number(e.target.value) })}
                className={`max-w-xs ${formErrors.limite_credito ? "border-destructive" : ""}`}
              />
              {formErrors.limite_credito && <p className="text-xs text-destructive">{formErrors.limite_credito}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 pb-1 border-t">
            <Building2 className="w-4 h-4 text-primary/70" />
            <h3 className="font-semibold text-sm">Grupo Econômico</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Vincule o cliente a um grupo econômico para consolidar dados de vendas, crédito e relacionamento.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="space-y-1.5">
              <Label>Grupo Econômico</Label>
              <Select
                value={form.grupo_economico_id || "nenhum"}
                onValueChange={(v) => updateForm({ grupo_economico_id: v === "nenhum" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {grupos.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label>Tipo de Relação</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs space-y-1">
                    <p><strong>Matriz:</strong> empresa controladora do grupo.</p>
                    <p><strong>Filial:</strong> empresa controlada pela matriz.</p>
                    <p><strong>Coligada:</strong> empresa com participação societária no grupo.</p>
                    <p><strong>Independente:</strong> sem vínculo hierárquico.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={form.tipo_relacao_grupo}
                onValueChange={(v) => updateForm({ tipo_relacao_grupo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {relacaoOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.grupo_economico_id ? (
            <div className="mb-4 flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2 text-xs text-muted-foreground border">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-primary/60" />
              <span>
                <strong className="text-foreground">{grupos.find(g => g.id === form.grupo_economico_id)?.nome}</strong>
                {" — "}{relacaoLabel[form.tipo_relacao_grupo] || form.tipo_relacao_grupo}
              </span>
            </div>
          ) : <div className="mb-4" />}

          <div className="flex items-center gap-2 pt-3 pb-3 border-t">
            <Truck className="w-4 h-4 text-primary/70" />
            <h3 className="font-semibold text-sm">Transportadoras Preferenciais</h3>
            {modalTransportadoras.length > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5">{modalTransportadoras.length}</Badge>
            )}
          </div>
          <div className="mb-4">
            {mode === "create" ? (
              <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5 border border-dashed text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Transportadoras preferenciais podem ser vinculadas após o cadastro inicial do cliente.
                </span>
              </div>
            ) : loadingTransportadoras ? (
              <div className="h-[60px] rounded-lg bg-muted/30 animate-pulse" />
            ) : (
              <>
                {/* Add new transport link */}
                <div className="flex gap-2 mb-3">
                  <Select value={vinculoTranspId} onValueChange={setVinculoTranspId}>
                    <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Selecionar transportadora..." /></SelectTrigger>
                    <SelectContent>
                      {transportadorasList
                        .filter(t => !modalTransportadoras.some(ct => ct.transportadora_id === t.id))
                        .map(t => <SelectItem key={t.id} value={t.id}>{t.nome_razao_social}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button" size="sm"
                    disabled={!vinculoTranspId || savingVinculo}
                    onClick={() => selected && handleAddTransportadora(selected.id)}
                    className="gap-1 h-9"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Vincular
                  </Button>
                </div>
                {modalTransportadoras.length === 0 ? (
                  <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5 border border-dashed text-xs text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>Nenhuma transportadora vinculada. Use o seletor acima para vincular.</span>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {modalTransportadoras.map((ct) => (
                      <div key={ct.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors border-b last:border-b-0 group">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          {ct.prioridade === 1 && <Star className="h-3 w-3 text-amber-500 shrink-0" />}
                          <span className="text-xs font-medium text-foreground truncate">{ct.transportadora_nome}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {ct.modalidade && <span className="text-xs text-muted-foreground capitalize">{ct.modalidade}</span>}
                          {ct.prazo_medio && <span className="text-xs text-muted-foreground font-mono">{ct.prazo_medio}d</span>}
                          <Button
                            type="button" size="icon" variant="ghost"
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remover vínculo"
                            onClick={() => selected && handleRemoveTransportadora(ct.id, selected.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
            </TabsContent>

            {/* ── TAB: ENTREGAS ──────────────────────────── */}
            {mode === "edit" && (
            <TabsContent value="entregas" className="space-y-4 mt-0">
          <div className="flex items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-primary/70" />
              <h3 className="font-semibold text-sm">Endereços de Entrega</h3>
              {enderecos.length > 0 && <Badge variant="secondary" className="text-xs">{enderecos.length}</Badge>}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => {
                setEnderecoForm({ ...emptyEnderecoForm, principal: enderecos.length === 0 });
                setEnderecoEditId(null);
                setEnderecoDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Incluir
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Endereços alternativos de entrega para este cliente. Um pode ser marcado como principal.
          </p>
          {loadingEnderecos ? (
            <div className="h-20 bg-muted/30 rounded-lg animate-pulse" />
          ) : enderecos.length === 0 ? (
            <div className="flex items-center gap-2 bg-muted/20 rounded-lg px-3 py-4 border border-dashed text-xs text-muted-foreground">
              <Home className="h-3.5 w-3.5 shrink-0" />
              <span>Nenhum endereço de entrega cadastrado. Clique em <strong>Incluir</strong> para adicionar.</span>
            </div>
          ) : (
            <div className="space-y-1">
              {enderecos.map((end) => (
                <div key={end.id} className="group rounded-lg border bg-card p-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {end.principal && <span title="Principal"><Star className="h-3.5 w-3.5 text-amber-500 shrink-0" /></span>}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{end.identificacao}</span>
                          {end.principal && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300">Principal</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[end.logradouro, end.numero, end.complemento].filter(Boolean).join(", ")}
                          {end.bairro ? ` — ${end.bairro}` : ""}
                          {end.cidade ? ` — ${end.cidade}` : ""}
                          {end.uf ? `/${end.uf}` : ""}
                          {end.cep ? ` (${end.cep})` : ""}
                        </p>
                        {(end.contato || end.telefone) && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[end.contato, end.telefone].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!end.principal && selected && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                              aria-label="Marcar como principal"
                              onClick={() => selected && handleSetPrincipalEndereco(end.id, selected.id)}>
                              <Star className="h-3.5 w-3.5 text-amber-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Marcar como principal</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                            aria-label="Editar endereço"
                            onClick={() => {
                              setEnderecoForm({
                                identificacao: end.identificacao,
                                logradouro: end.logradouro || "", numero: end.numero || "",
                                complemento: end.complemento || "", bairro: end.bairro || "",
                                cidade: end.cidade || "", uf: end.uf || "", cep: end.cep || "",
                                contato: end.contato || "", telefone: end.telefone || "",
                                principal: end.principal, ativo: end.ativo,
                                observacoes: end.observacoes || "",
                              });
                              setEnderecoEditId(end.id);
                              setEnderecoDialogOpen(true);
                            }}>
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                            aria-label="Remover endereço"
                            onClick={() => selected && handleRemoveEndereco(end.id, selected.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remover</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </TabsContent>
            )}

            {/* ── TAB: OBSERVAÇÕES ──────────────────────────── */}
            <TabsContent value="observacoes" className="space-y-4 mt-0">
          <p className="text-xs text-muted-foreground mb-3">
            Notas internas e contexto adicional sobre o cliente. Visível apenas internamente.
          </p>
          <div className="mb-6">
            <Textarea
              rows={5}
              maxLength={MAX_OBSERVACOES_LENGTH}
              value={form.observacoes}
              onChange={(e) => updateForm({ observacoes: e.target.value })}
              placeholder="Informações relevantes sobre o cliente: preferências, restrições, histórico de relacionamento..."
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{(form.observacoes || "").length}/{MAX_OBSERVACOES_LENGTH}</p>
          </div>
            </TabsContent>
          </Tabs>

          {/* ── RODAPÉ ────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (isDirty && !window.confirm("Existem alterações não salvas. Deseja descartar as alterações?")) return;
                setModalOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving} className="min-w-[100px]">
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : "Salvar"}
            </Button>
          </div>
        </form>
      </FormModal>

      {/* ── Dialog: Endereço de Entrega ──────────────── */}
      <Dialog open={enderecoDialogOpen} onOpenChange={(v) => { if (!v) { setEnderecoDialogOpen(false); setEnderecoEditId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{enderecoEditId ? "Editar Endereço de Entrega" : "Novo Endereço de Entrega"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <Label>Identificação <span className="text-destructive">*</span></Label>
              <Input
                value={enderecoForm.identificacao}
                onChange={(e) => setEnderecoForm({ ...enderecoForm, identificacao: e.target.value })}
                placeholder="Ex: Filial SP, Depósito Central"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label>CEP</Label>
                <div className="flex gap-2">
                  <Input
                    value={enderecoForm.cep || ""}
                    onChange={(e) => setEnderecoForm({ ...enderecoForm, cep: e.target.value })}
                    placeholder="00000-000"
                    maxLength={9}
                    className="flex-1"
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={cepEnderecoLoading || (enderecoForm.cep || "").replace(/\D/g, "").length < 8}
                    onClick={async () => {
                      const result = await buscarCepEndereco(enderecoForm.cep || "");
                      if (result) setEnderecoForm({ ...enderecoForm, logradouro: result.logradouro, bairro: result.bairro, cidade: result.localidade, uf: result.uf });
                    }}
                    aria-label="Buscar CEP"
                  >
                    {cepEnderecoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="w-24 space-y-2">
                <Label>Número</Label>
                <Input value={enderecoForm.numero || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, numero: e.target.value })} placeholder="Nº" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Logradouro</Label>
              <Input value={enderecoForm.logradouro || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, logradouro: e.target.value })} placeholder="Rua, Avenida..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input value={enderecoForm.complemento || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, complemento: e.target.value })} placeholder="Sala, Bloco..." />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input value={enderecoForm.bairro || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, bairro: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={enderecoForm.cidade || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, cidade: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Input maxLength={2} value={enderecoForm.uf || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, uf: e.target.value.toUpperCase() })} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={enderecoForm.contato || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, contato: e.target.value })} placeholder="Nome do responsável" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={enderecoForm.telefone || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, telefone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={enderecoForm.observacoes || ""} onChange={(e) => setEnderecoForm({ ...enderecoForm, observacoes: e.target.value })} rows={2} placeholder="Instruções de entrega, restrições de acesso..." />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => { setEnderecoDialogOpen(false); setEnderecoEditId(null); }}>Cancelar</Button>
              <Button
                type="button"
                disabled={savingEndereco}
                onClick={() => selected && handleSaveEndereco(selected.id)}
              >
                {savingEndereco ? "Salvando..." : "Salvar Endereço"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Nova Comunicação ──────────────────── */}
      <Dialog open={comunicacaoDialogOpen} onOpenChange={(v) => { if (!v) setComunicacaoDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Registrar Comunicação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={comunicacaoForm.tipo} onValueChange={(v) => setComunicacaoForm({ ...comunicacaoForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMUNICACAO_TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={comunicacaoForm.status} onValueChange={(v) => setComunicacaoForm({ ...comunicacaoForm, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMUNICACAO_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assunto <span className="text-destructive">*</span></Label>
              <Input value={comunicacaoForm.assunto} onChange={(e) => setComunicacaoForm({ ...comunicacaoForm, assunto: e.target.value })} placeholder="Resumo da comunicação" />
            </div>
            <div className="space-y-2">
              <Label>Descrição / Conteúdo</Label>
              <Textarea
                value={comunicacaoForm.conteudo}
                onChange={(e) => setComunicacaoForm({ ...comunicacaoForm, conteudo: e.target.value })}
                rows={3}
                placeholder="Detalhes da comunicação, pontos discutidos, conclusões..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input value={comunicacaoForm.responsavel_nome} onChange={(e) => setComunicacaoForm({ ...comunicacaoForm, responsavel_nome: e.target.value })} placeholder="Nome do responsável" />
              </div>
              <div className="space-y-2">
                <Label>Retorno Previsto</Label>
                <Input type="date" value={comunicacaoForm.retorno_previsto} onChange={(e) => setComunicacaoForm({ ...comunicacaoForm, retorno_previsto: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setComunicacaoDialogOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                disabled={savingComunicacao}
                onClick={() => selected && handleSaveComunicacao(selected.id)}
              >
                {savingComunicacao ? "Registrando..." : "Registrar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </AppLayout>);

};

export default Clientes;
