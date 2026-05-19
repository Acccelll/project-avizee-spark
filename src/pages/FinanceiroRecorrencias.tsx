import { useEffect, useMemo, useState } from "react";
import { Wallet, Play, Pause, StopCircle, Zap, Eye, Trash2, RefreshCw, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { FormSection } from "@/components/FormSection";
import { SummaryCard } from "@/components/SummaryCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import { FORMA_PAGAMENTO_OPTIONS, FORMA_PAGAMENTO_LABELS } from "@/lib/financeiro";
import {
  listRecorrencias,
  createRecorrencia,
  updateRecorrencia,
  setRecorrenciaStatus,
  deleteRecorrencia,
  gerarRecorrenciaAgora,
  listLancamentosDaRecorrencia,
  PERIODICIDADE_OPTIONS,
  periodicidadeLabel,
  type Recorrencia,
  type RecorrenciaInsert,
} from "@/services/recorrencias.service";
import { listCartoes, type CartaoCredito } from "@/services/cartoesCredito.service";
import {
  listContasBancarias,
  type ContaBancaria,
} from "@/services/contasBancarias.service";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente, Fornecedor, ContaContabil } from "@/types/domain";
import { useEditDirtyForm } from "@/hooks/useEditDirtyForm";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useCanHardDelete } from "@/hooks/useCanHardDelete";
import { AutocompleteSearch } from "@/components/ui/AutocompleteSearch";

interface RecorrenciaForm {
  tipo: "receber" | "pagar";
  descricao: string;
  valor: number;
  periodicidade: "mensal" | "bimestral" | "trimestral" | "semestral" | "anual";
  dia_vencimento: number | null;
  data_inicio: string;
  data_fim: string;
  qtd_ciclos_max: number | null;
  forma_pagamento: string;
  cartao_id: string;
  cliente_id: string;
  fornecedor_id: string;
  conta_bancaria_id: string;
  conta_contabil_id: string;
  observacoes: string;
  ativo: boolean;
}

const today = () => new Date().toISOString().split("T")[0];

const emptyForm: RecorrenciaForm = {
  tipo: "pagar",
  descricao: "",
  valor: 0,
  periodicidade: "mensal",
  dia_vencimento: new Date().getDate(),
  data_inicio: today(),
  data_fim: "",
  qtd_ciclos_max: null,
  forma_pagamento: "cartao_credito",
  cartao_id: "",
  cliente_id: "",
  fornecedor_id: "",
  conta_bancaria_id: "",
  conta_contabil_id: "",
  observacoes: "",
  ativo: true,
};

export default function FinanceiroRecorrencias() {
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");

  const [cartoes, setCartoes] = useState<CartaoCredito[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contasContabeis, setContasContabeis] = useState<ContaContabil[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Recorrencia | null>(null);

  const [encerrarTarget, setEncerrarTarget] = useState<Recorrencia | null>(null);
  const [encerrarMotivo, setEncerrarMotivo] = useState("");
  const [encerrarMode, setEncerrarMode] = useState<"encerrada" | "cancelada">("encerrada");

  const [viewTarget, setViewTarget] = useState<Recorrencia | null>(null);
  const [viewLancamentos, setViewLancamentos] = useState<
    Array<{
      id: string;
      descricao: string;
      valor: number;
      data_vencimento: string;
      status: string;
      recorrencia_ciclo: number | null;
    }>
  >([]);
  const [viewLoading, setViewLoading] = useState(false);

  const { form, updateForm, reset, isDirty, markPristine } =
    useEditDirtyForm<RecorrenciaForm>(emptyForm);
  const { saving, submit } = useSubmitLock();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { canHardDelete: isAdmin } = useCanHardDelete();

  const fetchAux = async () => {
    try {
      const [cs, cb] = await Promise.all([listCartoes(), listContasBancarias()]);
      setCartoes(cs);
      setContasBancarias(cb);
      const { data: cli } = await supabase
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj")
        .eq("ativo", true)
        .order("nome_razao_social");
      setClientes((cli || []) as Cliente[]);
      const { data: forn } = await supabase
        .from("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj")
        .eq("ativo", true)
        .order("nome_razao_social");
      setFornecedores((forn || []) as Fornecedor[]);
      const { data: cc } = await supabase
        .from("contas_contabeis")
        .select("id, codigo, descricao")
        .order("codigo");
      setContasContabeis((cc || []) as ContaContabil[]);
    } catch (e) {
      notifyError(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await listRecorrencias();
      setRecorrencias(data);
    } catch (e) {
      notifyError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAux();
    fetchData();
  }, []);

  const ativos = useMemo(
    () => recorrencias.filter((r) => r.status === "ativa"),
    [recorrencias],
  );
  const totalMensalReceber = useMemo(
    () =>
      ativos
        .filter((r) => r.tipo === "receber" && r.periodicidade === "mensal")
        .reduce((s, r) => s + Number(r.valor), 0),
    [ativos],
  );
  const totalMensalPagar = useMemo(
    () =>
      ativos
        .filter((r) => r.tipo === "pagar" && r.periodicidade === "mensal")
        .reduce((s, r) => s + Number(r.valor), 0),
    [ativos],
  );
  const proximos7Dias = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() + 7);
    const lim = limite.toISOString().split("T")[0];
    return ativos.filter((r) => r.proxima_geracao <= lim).length;
  }, [ativos]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return recorrencias.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroTipo && r.tipo !== filtroTipo) return false;
      if (!q) return true;
      return (
        r.descricao.toLowerCase().includes(q) ||
        (r.clientes?.nome_razao_social || "").toLowerCase().includes(q) ||
        (r.fornecedores?.nome_razao_social || "").toLowerCase().includes(q)
      );
    });
  }, [recorrencias, searchTerm, filtroStatus, filtroTipo]);

  const openCreate = () => {
    setMode("create");
    setSelected(null);
    reset({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (r: Recorrencia) => {
    setMode("edit");
    setSelected(r);
    reset({
      tipo: r.tipo as "receber" | "pagar",
      descricao: r.descricao,
      valor: Number(r.valor),
      periodicidade: r.periodicidade as RecorrenciaForm["periodicidade"],
      dia_vencimento: r.dia_vencimento,
      data_inicio: r.data_inicio,
      data_fim: r.data_fim || "",
      qtd_ciclos_max: r.qtd_ciclos_max,
      forma_pagamento: r.forma_pagamento || "",
      cartao_id: r.cartao_id || "",
      cliente_id: r.cliente_id || "",
      fornecedor_id: r.fornecedor_id || "",
      conta_bancaria_id: r.conta_bancaria_id || "",
      conta_contabil_id: r.conta_contabil_id || "",
      observacoes: r.observacoes || "",
      ativo: r.ativo,
    });
    setModalOpen(true);
  };

  const closeModal = async () => {
    if (isDirty && !(await confirm())) return;
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao.trim()) {
      toast.error("Descrição obrigatória");
      return;
    }
    if (form.valor <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }
    if (!form.data_inicio) {
      toast.error("Data de início obrigatória");
      return;
    }
    if (form.forma_pagamento === "cartao_credito" && !form.cartao_id) {
      toast.error("Selecione o cartão");
      return;
    }

    await submit(async () => {
      const payload: RecorrenciaInsert = {
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        valor: form.valor,
        periodicidade: form.periodicidade,
        dia_vencimento: form.dia_vencimento,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        proxima_geracao:
          mode === "create" ? form.data_inicio : (selected?.proxima_geracao ?? form.data_inicio),
        qtd_ciclos_max: form.qtd_ciclos_max,
        forma_pagamento: form.forma_pagamento || null,
        cartao_id: form.cartao_id || null,
        cliente_id: form.tipo === "receber" ? form.cliente_id || null : null,
        fornecedor_id: form.tipo === "pagar" ? form.fornecedor_id || null : null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        conta_contabil_id: form.conta_contabil_id || null,
        observacoes: form.observacoes || null,
        ativo: form.ativo,
      };
      try {
        if (mode === "create") {
          await createRecorrencia(payload);
          toast.success("Recorrência criada");
        } else if (selected) {
          await updateRecorrencia(selected.id, payload);
          toast.success("Recorrência atualizada");
        }
        markPristine();
        setModalOpen(false);
        await fetchData();
      } catch (err) {
        notifyError(err);
      }
    });
  };

  const handlePausarReativar = async (r: Recorrencia) => {
    try {
      const next = r.status === "ativa" ? "pausada" : "ativa";
      await setRecorrenciaStatus(r.id, next);
      toast.success(next === "ativa" ? "Recorrência reativada" : "Recorrência pausada");
      await fetchData();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleGerarAgora = async (r: Recorrencia) => {
    try {
      const id = await gerarRecorrenciaAgora(r.id);
      if (id) {
        toast.success("Lançamento gerado");
      } else {
        toast.info("Nenhum ciclo elegível agora");
      }
      await fetchData();
    } catch (e) {
      notifyError(e);
    }
  };

  const confirmEncerrar = async () => {
    if (!encerrarTarget) return;
    if (!encerrarMotivo.trim()) {
      toast.error("Informe o motivo");
      return;
    }
    try {
      await setRecorrenciaStatus(encerrarTarget.id, encerrarMode, encerrarMotivo.trim());
      toast.success(
        encerrarMode === "encerrada" ? "Recorrência encerrada" : "Recorrência cancelada",
      );
      setEncerrarTarget(null);
      setEncerrarMotivo("");
      await fetchData();
    } catch (e) {
      notifyError(e);
    }
  };

  const handleDelete = async (r: Recorrencia) => {
    if (!(await confirm())) return;
    try {
      await deleteRecorrencia(r.id);
      toast.success("Recorrência excluída");
      await fetchData();
    } catch (e) {
      notifyError(e);
    }
  };

  const openView = async (r: Recorrencia) => {
    setViewTarget(r);
    setViewLoading(true);
    try {
      const lancs = await listLancamentosDaRecorrencia(r.id);
      setViewLancamentos(lancs);
    } catch (e) {
      notifyError(e);
    } finally {
      setViewLoading(false);
    }
  };

  const isCartao = form.forma_pagamento === "cartao_credito";
  const cartaoSelecionado = cartoes.find((c) => c.id === form.cartao_id);

  const summaryCards = (
    <>
      <SummaryCard title="Ativas" value={ativos.length} icon={Play} />
      <SummaryCard
        title="Mensal a Receber"
        value={formatCurrency(totalMensalReceber)}
        icon={Wallet}
        variant="success"
      />
      <SummaryCard
        title="Mensal a Pagar"
        value={formatCurrency(totalMensalPagar)}
        icon={Wallet}
        variant="danger"
      />
      <SummaryCard title="Próx. 7 dias" value={proximos7Dias} icon={Zap} />
    </>
  );

  const filtersNode = (
    <>
      <Select value={filtroTipo || "todos"} onValueChange={(v) => setFiltroTipo(v === "todos" ? "" : v)}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          <SelectItem value="receber">A Receber</SelectItem>
          <SelectItem value="pagar">A Pagar</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filtroStatus || "todos"} onValueChange={(v) => setFiltroStatus(v === "todos" ? "" : v)}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="ativa">Ativa</SelectItem>
          <SelectItem value="pausada">Pausada</SelectItem>
          <SelectItem value="encerrada">Encerrada</SelectItem>
          <SelectItem value="cancelada">Cancelada</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <ModulePage
      title="Cobranças Recorrentes"
      subtitle="Assinaturas e mensalidades que geram lançamentos automaticamente a cada ciclo."
      addLabel="Nova Recorrência"
      onAdd={openCreate}
      headerActions={
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      }
      summaryCards={summaryCards}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Buscar por descrição, cliente ou fornecedor..."
      filters={filtersNode}
      count={filtered.length}
    >
      <DataTable<Recorrencia>
        loading={loading}
        data={filtered}
        moduleKey="financeiro-recorrencias"
        emptyTitle="Nenhuma recorrência cadastrada"
        emptyDescription="Crie sua primeira assinatura ou mensalidade recorrente."
        onView={(r) => openView(r)}
        onEdit={(r) => openEdit(r)}
        onDelete={isAdmin ? (r) => handleDelete(r) : undefined}
        deleteBehavior="hard"
        mobileStatusKey="status"
        mobileIdentifierKey="descricao"
        rowExtraActions={(r) => (
          <div className="flex gap-1">
            {r.status === "ativa" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGerarAgora(r);
                  }}
                  title="Gerar lançamento agora"
                >
                  <Zap className="h-3 w-3" /> Gerar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePausarReativar(r);
                  }}
                  title="Pausar"
                >
                  <Pause className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEncerrarTarget(r);
                    setEncerrarMode("encerrada");
                    setEncerrarMotivo("");
                  }}
                  title="Encerrar"
                >
                  <StopCircle className="h-3 w-3" />
                </Button>
              </>
            )}
            {r.status === "pausada" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePausarReativar(r);
                }}
                title="Reativar"
              >
                <Play className="h-3 w-3" /> Reativar
              </Button>
            )}
          </div>
        )}
        columns={[
          {
            key: "descricao",
            label: "Descrição",
            mobilePrimary: true,
            render: (r) => (
              <div className="flex flex-col">
                <span className="font-medium">{r.descricao}</span>
                <span className="text-xs text-muted-foreground">
                  {r.tipo === "receber"
                    ? r.clientes?.nome_razao_social
                    : r.fornecedores?.nome_razao_social}
                </span>
              </div>
            ),
          },
          {
            key: "tipo",
            label: "Tipo",
            render: (r) => <StatusBadge status={r.tipo === "receber" ? "receita" : "despesa"} />,
          },
          {
            key: "valor",
            label: "Valor",
            mobileCard: true,
            render: (r) => formatCurrency(Number(r.valor)),
          },
          {
            key: "periodicidade",
            label: "Periodicidade",
            render: (r) => periodicidadeLabel(r.periodicidade),
          },
          {
            key: "proxima_geracao",
            label: "Próx. geração",
            mobileCard: true,
            render: (r) => formatDate(r.proxima_geracao),
          },
          {
            key: "forma_pagamento",
            label: "Forma",
            render: (r) => {
              const fp = r.forma_pagamento as keyof typeof FORMA_PAGAMENTO_LABELS;
              const cartao = r.cartoes_credito;
              return (
                <div className="flex flex-col text-xs">
                  <span>{FORMA_PAGAMENTO_LABELS[fp] ?? "—"}</span>
                  {cartao && (
                    <span className="text-muted-foreground">
                      {cartao.nome}
                      {cartao.ultimos4 ? ` ••${cartao.ultimos4}` : ""}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
        ]}
      />

      {/* ── Form Modal ───────────────────────────────────────────── */}
      <FormModal
        open={modalOpen}
        onClose={closeModal}
        title={mode === "create" ? "Nova Recorrência" : "Editar Recorrência"}
        mode={mode}
        size="lg"
        isDirty={isDirty}
        confirmOnDirty
        footer={
          <FormModalFooter
            saving={saving}
            isDirty={isDirty}
            onCancel={closeModal}
            submitAsForm
            formId="recorrencia-form"
            mode={mode}
            primaryLabel={mode === "create" ? "Criar" : "Salvar"}
          />
        }
      >
        <form id="recorrencia-form" onSubmit={handleSubmit} className="space-y-5">
          <FormSection icon={Wallet} title="Identificação" noBorder>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v) =>
                    updateForm({ tipo: v as RecorrenciaForm["tipo"], cliente_id: "", fornecedor_id: "" })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pagar">A Pagar (despesa)</SelectItem>
                    <SelectItem value="receber">A Receber (receita)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Descrição *</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => updateForm({ descricao: e.target.value })}
                  placeholder="Ex.: Netflix Premium, Hospedagem AWS, Mensalidade Cliente X"
                  required
                />
              </div>
              <div className="sm:col-span-3 space-y-2">
                <Label>{form.tipo === "receber" ? "Cliente" : "Fornecedor"}</Label>
                {form.tipo === "receber" ? (
                  <AutocompleteSearch
                    options={clientes.map((c) => ({
                      id: c.id,
                      label: c.nome_razao_social,
                      sublabel: c.cpf_cnpj ?? undefined,
                    }))}
                    value={form.cliente_id}
                    onChange={(v) => updateForm({ cliente_id: v })}
                    placeholder="Buscar cliente..."
                  />
                ) : (
                  <AutocompleteSearch
                    options={fornecedores.map((f) => ({
                      id: f.id,
                      label: f.nome_razao_social,
                      sublabel: f.cpf_cnpj ?? undefined,
                    }))}
                    value={form.fornecedor_id}
                    onChange={(v) => updateForm({ fornecedor_id: v })}
                    placeholder="Buscar fornecedor..."
                  />
                )}
              </div>
            </div>
          </FormSection>

          <FormSection icon={Zap} title="Valor & Ciclo">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Valor *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={form.valor || ""}
                  onChange={(e) => updateForm({ valor: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Periodicidade *</Label>
                <Select
                  value={form.periodicidade}
                  onValueChange={(v) =>
                    updateForm({ periodicidade: v as RecorrenciaForm["periodicidade"] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODICIDADE_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dia do vencimento</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.dia_vencimento ?? ""}
                  onChange={(e) =>
                    updateForm({
                      dia_vencimento: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="1–31"
                />
              </div>
              <div className="space-y-2">
                <Label>Data de início *</Label>
                <Input
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => updateForm({ data_inicio: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Data fim (opcional)</Label>
                <Input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => updateForm({ data_fim: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. máx. de ciclos (opcional)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.qtd_ciclos_max ?? ""}
                  onChange={(e) =>
                    updateForm({
                      qtd_ciclos_max: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Sem limite"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              A geração automática roda diariamente. O primeiro lançamento será criado a partir
              da data de início.
            </p>
          </FormSection>

          <FormSection icon={Wallet} title="Pagamento">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={form.forma_pagamento || "nenhum"}
                  onValueChange={(v) =>
                    updateForm({
                      forma_pagamento: v === "nenhum" ? "" : v,
                      cartao_id: v === "cartao_credito" ? form.cartao_id : "",
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">— Nenhuma —</SelectItem>
                    {FORMA_PAGAMENTO_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isCartao && (
                <div className="space-y-2">
                  <Label>Cartão *</Label>
                  {cartoes.filter((c) => c.ativo).length > 0 ? (
                    <Select
                      value={form.cartao_id || ""}
                      onValueChange={(v) => updateForm({ cartao_id: v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {cartoes
                          .filter((c) => c.ativo)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                              {c.ultimos4 ? ` ••${c.ultimos4}` : ""}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Nenhum cartão ativo —{" "}
                      <Link to="/cartoes-credito" className="underline">
                        cadastrar cartão
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
              {isCartao && cartaoSelecionado && (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Vencimento dos lançamentos seguirá a fatura do cartão (fechamento dia{" "}
                  {cartaoSelecionado.dia_fechamento}, vencimento dia{" "}
                  {cartaoSelecionado.dia_vencimento}).
                </p>
              )}
              <div className="space-y-2">
                <Label>Conta bancária</Label>
                <Select
                  value={form.conta_bancaria_id || "nenhum"}
                  onValueChange={(v) =>
                    updateForm({ conta_bancaria_id: v === "nenhum" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>
                    {contasBancarias.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Conta contábil</Label>
                <Select
                  value={form.conta_contabil_id || "nenhum"}
                  onValueChange={(v) =>
                    updateForm({ conta_contabil_id: v === "nenhum" ? "" : v })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">—</SelectItem>
                    {contasContabeis.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.codigo} — {cc.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Outros">
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => updateForm({ observacoes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
              <div>
                <Label className="text-sm font-medium">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Desativado equivale a pausado: nenhum ciclo será gerado.
                </p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => updateForm({ ativo: v })} />
            </div>
          </FormSection>
        </form>
      </FormModal>

      {/* ── Dialog Encerrar / Cancelar ──────────────────────────── */}
      <Dialog open={!!encerrarTarget} onOpenChange={(o) => !o && setEncerrarTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {encerrarMode === "encerrada" ? "Encerrar" : "Cancelar"} recorrência
            </DialogTitle>
            <DialogDescription>
              Lançamentos já gerados não são afetados. A recorrência deixará de gerar novos
              ciclos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={encerrarMode === "encerrada" ? "default" : "outline"}
                onClick={() => setEncerrarMode("encerrada")}
              >
                Encerrar
              </Button>
              <Button
                size="sm"
                variant={encerrarMode === "cancelada" ? "destructive" : "outline"}
                onClick={() => setEncerrarMode("cancelada")}
              >
                Cancelar
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Textarea
                value={encerrarMotivo}
                onChange={(e) => setEncerrarMotivo(e.target.value)}
                placeholder="Ex.: assinatura encerrada pelo fornecedor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarTarget(null)}>
              Voltar
            </Button>
            <Button onClick={confirmEncerrar}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sheet Ver Lançamentos ───────────────────────────────── */}
      <Sheet open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Lançamentos gerados</SheetTitle>
            <SheetDescription>
              {viewTarget?.descricao} — {viewTarget?.ciclos_gerados ?? 0} ciclo(s) gerado(s).
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 max-h-[70vh] overflow-y-auto">
            {viewLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : viewLancamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lançamento gerado ainda.</p>
            ) : (
              viewLancamentos.map((l) => (
                <Link
                  key={l.id}
                  to={`/financeiro/${l.id}`}
                  className="block rounded-lg border p-3 hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">
                        Ciclo #{l.recorrencia_ciclo ?? "—"} · {l.descricao}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Venc: {formatDate(l.data_vencimento)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(l.valor))}
                      </span>
                      <StatusBadge status={l.status} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </ModulePage>
  );
}