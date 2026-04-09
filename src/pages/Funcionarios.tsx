import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormModal } from "@/components/FormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { StatCard } from "@/components/StatCard";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Edit, Trash2, DollarSign, Users, UserCheck, UserX, CalendarDays, FileText, AlertTriangle, CheckCircle2, HelpCircle, Loader2, Info } from "lucide-react";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

interface Funcionario {
  id: string; nome: string; cpf: string; cargo: string; departamento: string;
  data_admissao: string; data_demissao: string | null; salario_base: number;
  tipo_contrato: string; observacoes: string; ativo: boolean; created_at: string;
}

interface FolhaPagamento {
  id: string; funcionario_id: string; competencia: string; salario_base: number;
  proventos: number; descontos: number; valor_liquido: number; observacoes: string;
  status: string; financeiro_gerado: boolean;
}

interface FinanceiroLancamento {
  id: string; descricao: string; valor: number; data_vencimento: string;
  data_pagamento: string | null; status: string;
}

const tipoContratoLabel: Record<string, string> = { clt: "CLT", pj: "PJ", estagio: "Estágio", temporario: "Temporário" };

/** Typed form for create/edit — avoids `Record<string, any>`. */
interface FuncionarioForm {
  nome: string; cpf: string; cargo: string; departamento: string;
  data_admissao: string; data_demissao: string | null; salario_base: number;
  tipo_contrato: string; observacoes: string; ativo: boolean;
}

const emptyForm: FuncionarioForm = {
  nome: "", cpf: "", cargo: "", departamento: "", data_admissao: new Date().toISOString().split("T")[0],
  data_demissao: null, salario_base: 0, tipo_contrato: "clt", observacoes: "", ativo: true,
};

/**
 * Local augmented type for financeiro_lancamentos rows that include
 * `funcionario_id`.  The generated types don't carry this column yet;
 * this local definition prevents scattered `as any` casts until the
 * DB types are regenerated.
 */
interface FinanceiroLancamentoComFuncionario {
  tipo: "pagar";
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  funcionario_id: string;
  ativo: boolean;
}

export default function Funcionarios() {
  const { data, loading, create, update, remove } = useSupabaseCrud<Funcionario>({ table: "funcionarios" as any });
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Funcionario | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FuncionarioForm>(emptyForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ativoFilters, setAtivoFilters] = useState<string[]>([]);
  const [tipoContratoFilters, setTipoContratoFilters] = useState<string[]>([]);

  // Folha states
  const [folhaModalOpen, setFolhaModalOpen] = useState(false);
  const [folhaForm, setFolhaForm] = useState({ competencia: "", proventos: 0, descontos: 0, observacoes: "" });
  const [folhas, setFolhas] = useState<FolhaPagamento[]>([]);
  const [loadingFolhas, setLoadingFolhas] = useState(false);

  // Financeiro states
  const [lancamentos, setLancamentos] = useState<FinanceiroLancamento[]>([]);
  const [loadingLancamentos, setLoadingLancamentos] = useState(false);

  const kpis = useMemo(() => {
    const ativos = data.filter(f => f.ativo);
    const totalSalarios = ativos.reduce((s, f) => s + Number(f.salario_base || 0), 0);
    return { total: data.length, ativos: ativos.length, inativos: data.length - ativos.length, totalSalarios };
  }, [data]);

  // Derived values used in the edit form context section
  const lancamentosAbertos = lancamentos.filter(l => l.status === "aberto");

  const openCreate = () => {  setMode("create"); setForm({ ...emptyForm }); setSelected(null); setModalOpen(true); };
  const openEdit = (f: Funcionario) => {
    setMode("edit"); setSelected(f);
    setForm({ nome: f.nome, cpf: f.cpf || "", cargo: f.cargo || "", departamento: f.departamento || "", data_admissao: f.data_admissao, data_demissao: f.data_demissao || null, salario_base: f.salario_base, tipo_contrato: f.tipo_contrato, observacoes: f.observacoes || "", ativo: f.ativo });
    setModalOpen(true);
  };

  const openView = async (f: Funcionario) => {
    setSelected(f); setDrawerOpen(true); setLoadingFolhas(true); setLoadingLancamentos(true);
    const [folhaResult, lancamentosResult] = await Promise.all([
      supabase.from("folha_pagamento" as any).select("*").eq("funcionario_id", f.id).order("competencia", { ascending: false }),
      // `funcionario_id` exists in the DB but is absent from the generated Supabase types.
      // The cast is intentional; remove once types are regenerated.
      supabase.from("financeiro_lancamentos").select("id,descricao,valor,data_vencimento,data_pagamento,status").eq("funcionario_id" as any, f.id).order("data_vencimento", { ascending: false }),
    ]);
    setFolhas((folhaResult.data as unknown as FolhaPagamento[]) || []);
    setLancamentos((lancamentosResult.data as unknown as FinanceiroLancamento[]) || []);
    setLoadingFolhas(false);
    setLoadingLancamentos(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (form.cpf && cpfDigits.length !== 11) { toast.error("CPF inválido. Informe os 11 dígitos."); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, data_demissao: form.data_demissao || null };
      if (mode === "create") await create(payload as any);
      else if (selected) {
        await update(selected.id, payload as any);
        if (selected.ativo && !form.ativo && folhas.length > 0) {
          toast.info(`${selected.nome} foi inativado. O histórico de folha foi preservado.`);
        }
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFolhaSubmit = async () => {
    if (!selected || !folhaForm.competencia) { toast.error("Competência é obrigatória"); return; }
    const liquido = Number(selected.salario_base) + Number(folhaForm.proventos) - Number(folhaForm.descontos);
    const { error } = await supabase.from("folha_pagamento" as any).insert({
      funcionario_id: selected.id,
      competencia: folhaForm.competencia,
      salario_base: selected.salario_base,
      proventos: folhaForm.proventos || 0,
      descontos: folhaForm.descontos || 0,
      valor_liquido: liquido,
      observacoes: folhaForm.observacoes || null,
      status: "processada",
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Folha registrada!");
    setFolhaModalOpen(false);
    openView(selected);
  };

  const handleFecharFolha = async (folha: FolhaPagamento) => {
    if (folha.financeiro_gerado) {
      toast.warning('Lançamentos financeiros já foram gerados para esta folha.');
      return;
    }

    const competenciaDate = new Date(folha.competencia + '-01');
    const mesRef = competenciaDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // Data de pagamento: 5º dia útil do mês seguinte (simplificado: dia 5)
    const proximoMes = new Date(competenciaDate.getFullYear(), competenciaDate.getMonth() + 1, 5);
    const dataPagamento = proximoMes.toISOString().slice(0, 10);

    // Data FGTS: dia 7 do mês seguinte
    const dataFgts = new Date(competenciaDate.getFullYear(), competenciaDate.getMonth() + 1, 7)
      .toISOString().slice(0, 10);

    // Lançamento do salário líquido
    const salarioPayload: FinanceiroLancamentoComFuncionario = {
      tipo: 'pagar',
      descricao: `Salário ${mesRef} — ${selected?.nome}`,
      valor: folha.valor_liquido,
      data_vencimento: dataPagamento,
      status: 'aberto',
      funcionario_id: folha.funcionario_id,
      ativo: true,
    };
    // `FinanceiroLancamentoComFuncionario` is a local type (funcionario_id absent from
    // generated Supabase types). Cast required until types are regenerated.
    await supabase.from('financeiro_lancamentos').insert(salarioPayload as any);

    // Calcular e lançar FGTS (8% do salário base)
    const fgts = Number(folha.salario_base) * 0.08;
    if (fgts > 0) {
      await supabase.from('financeiro_lancamentos').insert({
        tipo: 'pagar',
        descricao: `FGTS ${mesRef} — ${selected?.nome}`,
        valor: fgts,
        data_vencimento: dataFgts,
        status: 'aberto',
        ativo: true,
      } as any);
    }

    // Marcar folha como financeiro_gerado
    await supabase.from('folha_pagamento' as any)
      .update({ status: 'pago', financeiro_gerado: true })
      .eq('id', folha.id);

    toast.success(`Lançamentos financeiros gerados: salário (${dataPagamento}) e FGTS (${dataFgts}).`);
    openView(selected!);
  };

  const filteredData = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return data.filter(f => {
      if (q && ![f.nome, f.cpf, f.cargo, f.departamento].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      if (ativoFilters.length > 0) {
        const status = f.ativo ? "ativo" : "inativo";
        if (!ativoFilters.includes(status)) return false;
      }
      if (tipoContratoFilters.length > 0 && !tipoContratoFilters.includes(f.tipo_contrato)) return false;
      return true;
    });
  }, [data, searchTerm, ativoFilters, tipoContratoFilters]);

  const activeFilters = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    ativoFilters.forEach(f => chips.push({ key: "ativo", label: "Status", value: [f], displayValue: f === "ativo" ? "Ativo" : "Inativo" }));
    tipoContratoFilters.forEach(f => chips.push({ key: "tipo_contrato", label: "Contrato", value: [f], displayValue: tipoContratoLabel[f] || f }));
    return chips;
  }, [ativoFilters, tipoContratoFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "ativo") setAtivoFilters(prev => prev.filter(v => v !== value));
    else if (key === "tipo_contrato") setTipoContratoFilters(prev => prev.filter(v => v !== value));
  };

  const ativoOptions: MultiSelectOption[] = [
    { label: "Ativo", value: "ativo" },
    { label: "Inativo", value: "inativo" },
  ];

  const tipoContratoOptions: MultiSelectOption[] = [
    { label: "CLT", value: "clt" },
    { label: "PJ", value: "pj" },
    { label: "Estágio", value: "estagio" },
    { label: "Temporário", value: "temporario" },
  ];

  const columns = [
    { key: "nome", label: "Nome" },
    { key: "ativo", label: "Status", render: (f: Funcionario) => <StatusBadge status={f.ativo ? "Ativo" : "Inativo"} /> },
    { key: "cargo", label: "Cargo", render: (f: Funcionario) => f.cargo || "—" },
    { key: "departamento", label: "Depto.", render: (f: Funcionario) => f.departamento || "—" },
    { key: "tipo_contrato", label: "Contrato", render: (f: Funcionario) => tipoContratoLabel[f.tipo_contrato] || f.tipo_contrato },
    { key: "data_admissao", label: "Admissão", render: (f: Funcionario) => formatDate(f.data_admissao) },
    { key: "cpf", label: "CPF", hidden: true, render: (f: Funcionario) => f.cpf || "—" },
    { key: "salario_base", label: "Salário Base", hidden: true, render: (f: Funcionario) => <span className="font-mono">{formatCurrency(Number(f.salario_base))}</span> },
  ];

  // Current month as YYYY-MM for default competencia
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <AppLayout>
      <ModulePage
        title="Funcionários"
        subtitle="Central de consulta e gestão de funcionários"
        addLabel="Novo Funcionário"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total de Funcionários" value={String(kpis.total)} icon={Users} />
            <StatCard title="Ativos" value={String(kpis.ativos)} icon={UserCheck} iconColor="text-success" />
            <StatCard title="Inativos" value={String(kpis.inativos)} icon={UserX} iconColor={kpis.inativos > 0 ? "text-destructive" : undefined} />
            <StatCard title="Folha Mensal" value={formatCurrency(kpis.totalSalarios)} icon={DollarSign} />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, cargo, CPF, departamento..."
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setAtivoFilters([]); setTipoContratoFilters([]); }}
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
            options={tipoContratoOptions}
            selected={tipoContratoFilters}
            onChange={setTipoContratoFilters}
            placeholder="Contrato"
            className="w-[150px]"
          />
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="funcionarios"
          showColumnToggle={true}
          onView={openView}
        />
      </ModulePage>

      {/* Create/Edit Modal */}
      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title={mode === "create" ? "Novo Funcionário" : "Editar Funcionário"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* BLOCO: IDENTIFICAÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Identificação</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-nome" className="font-medium">Nome completo *</Label>
              <Input id="emp-nome" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do colaborador" required className="text-base" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-cpf">CPF <span className="text-muted-foreground text-xs font-normal">— identificador</span></Label>
                <Input id="emp-cpf" value={form.cpf} onChange={e => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
              </div>
              {mode === "edit" && (
                <div className="space-y-1.5">
                  <Label htmlFor="emp-status">Status do colaborador</Label>
                  <Select value={form.ativo ? "ativo" : "inativo"} onValueChange={v => setForm({ ...form, ativo: v === "ativo" })}>
                    <SelectTrigger id="emp-status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* BLOCO: VÍNCULO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Vínculo</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="emp-tipo-contrato">Tipo de Contrato</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex cursor-help"><HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[230px] text-xs">
                    CLT: vínculo com carteira assinada · PJ: prestação de serviços · Estágio: contrato de estágio · Temporário: prazo determinado
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select value={form.tipo_contrato} onValueChange={v => setForm({ ...form, tipo_contrato: v })}>
                <SelectTrigger id="emp-tipo-contrato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT — Consolidação das Leis do Trabalho</SelectItem>
                  <SelectItem value="pj">PJ — Pessoa Jurídica</SelectItem>
                  <SelectItem value="estagio">Estágio</SelectItem>
                  <SelectItem value="temporario">Temporário — prazo determinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-admissao">Data de Admissão *</Label>
                <Input id="emp-admissao" type="date" value={form.data_admissao} onChange={e => setForm({ ...form, data_admissao: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-demissao">Data de Desligamento</Label>
                <Input id="emp-demissao" type="date" value={form.data_demissao ?? ""} onChange={e => setForm({ ...form, data_demissao: e.target.value || null })} />
                {!form.data_demissao && <p className="text-[11px] text-muted-foreground">Preencher apenas se houver desligamento</p>}
              </div>
            </div>
          </div>

          {/* BLOCO: ESTRUTURA INTERNA */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Estrutura Interna</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-cargo">Cargo</Label>
                <Input id="emp-cargo" value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} placeholder="Ex: Analista, Operador..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-departamento">Departamento</Label>
                <Input id="emp-departamento" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} placeholder="Ex: TI, RH, Produção..." />
              </div>
            </div>
          </div>

          {/* BLOCO: REMUNERAÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Remuneração</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="emp-salario" className="font-medium">Salário Base *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="inline-flex cursor-help"><HelpCircle className="w-3.5 h-3.5 text-muted-foreground" /></button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px] text-xs">
                    Base para o cálculo da folha. Ao gerar financeiro: lançamento de salário (venc. dia 5) e FGTS 8% (venc. dia 7) do mês seguinte.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input id="emp-salario" type="number" step="0.01" min={0} value={form.salario_base} onChange={e => setForm({ ...form, salario_base: Number(e.target.value) })} required className="font-mono font-semibold text-base" />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3 shrink-0" />
                Impacta o cálculo da folha e os lançamentos financeiros (salário + FGTS).
              </p>
            </div>
          </div>

          {/* BLOCO: FOLHA / CONTEXTO FINANCEIRO (apenas em edição, quando há dados) */}
          {mode === "edit" && !loadingFolhas && (folhas.length > 0 || lancamentos.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Folha / Contexto Financeiro</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {folhas.length > 0
                      ? `${folhas.length} competência${folhas.length !== 1 ? "s" : ""} de folha registrada${folhas.length !== 1 ? "s" : ""}. Este colaborador gera lançamentos financeiros.`
                      : "Este colaborador possui lançamentos financeiros vinculados."}
                  </span>
                </p>
                <div className={`grid gap-2 ${folhas[0] ? "grid-cols-3" : "grid-cols-1"}`}>
                  {folhas[0] && (
                    <>
                      <div className="rounded-md border bg-background px-2.5 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Última Competência</p>
                        <p className="font-mono text-sm font-medium mt-0.5">{folhas[0].competencia}</p>
                      </div>
                      <div className="rounded-md border bg-background px-2.5 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Líquido Recente</p>
                        <p className="font-mono text-sm font-medium mt-0.5">{formatCurrency(Number(folhas[0].valor_liquido))}</p>
                      </div>
                    </>
                  )}
                  <div className="rounded-md border bg-background px-2.5 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Financeiro Pendente</p>
                    <p className={`font-mono text-sm font-medium mt-0.5 ${lancamentosAbertos.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {lancamentosAbertos.length > 0
                        ? `${lancamentosAbertos.length} aberto${lancamentosAbertos.length !== 1 ? "s" : ""}`
                        : "Em dia"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BLOCO: OBSERVAÇÕES */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Observações</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-obs">Notas internas <span className="text-muted-foreground text-xs font-normal">— visível apenas internamente</span></Label>
              <Textarea id="emp-obs" value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} placeholder="Notas sobre o colaborador, histórico relevante, acordos específicos..." rows={3} />
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
              {submitting ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </FormModal>

      {/* View Drawer */}
      {selected && (() => {
        const ultimaFolha = folhas[0] ?? null;
        const folhasPendentes = folhas.filter(f => !f.financeiro_gerado);
        const lancamentosPendentes = lancamentos.filter(l => l.status === "aberto");

        // Situação operacional
        let situacao: { label: string; variant: "default" | "secondary" | "destructive" | "outline" } = { label: "Ativo", variant: "default" };
        if (!selected.ativo) {
          situacao = { label: "Desligado", variant: "secondary" };
        } else if (folhas.length === 0) {
          situacao = { label: "Sem folha registrada", variant: "outline" };
        } else if (folhasPendentes.length > 0) {
          situacao = { label: "Folha pendente", variant: "outline" };
        } else if (lancamentosPendentes.length > 0) {
          situacao = { label: "Financeiro pendente", variant: "outline" };
        }

        const drawerSummary = (
          <div className="space-y-3">
            {/* Sub-header: cargo · depto · tipo · situação */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {selected.cargo && <span className="font-medium text-foreground">{selected.cargo}</span>}
              {selected.cargo && selected.departamento && <span>·</span>}
              {selected.departamento && <span>{selected.departamento}</span>}
              {(selected.cargo || selected.departamento) && selected.tipo_contrato && <span>·</span>}
              {selected.tipo_contrato && <Badge variant="secondary" className="text-xs font-normal">{tipoContratoLabel[selected.tipo_contrato] || selected.tipo_contrato}</Badge>}
              {situacao.label !== "Ativo" && (
                <Badge variant={situacao.variant} className="text-xs font-normal gap-1">
                  {(situacao.label === "Folha pendente" || situacao.label === "Financeiro pendente") && <AlertTriangle className="w-3 h-3" />}
                  {situacao.label}
                </Badge>
              )}
            </div>
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Salário Base</p>
                <p className="font-mono font-bold text-sm mt-0.5">{formatCurrency(Number(selected.salario_base))}</p>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admissão</p>
                <p className="font-mono font-bold text-sm mt-0.5">{formatDate(selected.data_admissao)}</p>
              </div>
              <div className={`rounded-md border px-3 py-2 ${!ultimaFolha ? "bg-muted/20 border-dashed" : "bg-muted/30"}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Última Competência</p>
                <p className="font-mono font-bold text-sm mt-0.5">{ultimaFolha ? ultimaFolha.competencia : <span className="text-muted-foreground font-normal text-xs">Sem registro</span>}</p>
              </div>
              <div className={`rounded-md border px-3 py-2 ${!ultimaFolha ? "bg-muted/20 border-dashed" : "bg-muted/30"}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Líquido Recente</p>
                <p className="font-mono font-bold text-sm mt-0.5">{ultimaFolha ? formatCurrency(Number(ultimaFolha.valor_liquido)) : <span className="text-muted-foreground font-normal text-xs">—</span>}</p>
              </div>
            </div>
          </div>
        );

        const tabResumo = (
          <div className="space-y-4">
            <ViewSection title="Identificação">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Nome">{selected.nome}</ViewField>
                <ViewField label="Status"><StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} /></ViewField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="CPF">{selected.cpf || "—"}</ViewField>
                <ViewField label="Tipo de Contrato">{tipoContratoLabel[selected.tipo_contrato] || selected.tipo_contrato}</ViewField>
              </div>
            </ViewSection>

            <ViewSection title="Estrutura">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Cargo">{selected.cargo || "—"}</ViewField>
                <ViewField label="Departamento">{selected.departamento || "—"}</ViewField>
              </div>
            </ViewSection>

            <ViewSection title="Vínculo">
              <div className="grid grid-cols-2 gap-4">
                <ViewField label="Data de Admissão">{formatDate(selected.data_admissao)}</ViewField>
                <ViewField label="Data de Desligamento">{selected.data_demissao ? formatDate(selected.data_demissao) : "—"}</ViewField>
              </div>
            </ViewSection>

            <ViewSection title="Remuneração">
              <ViewField label="Salário Base">
                <span className="font-mono font-semibold text-lg">{formatCurrency(Number(selected.salario_base))}</span>
              </ViewField>
            </ViewSection>

            {selected.observacoes && (
              <ViewSection title="Observações">
                <p className="text-sm text-foreground break-words">{selected.observacoes}</p>
              </ViewSection>
            )}
          </div>
        );

        const tabFolha = (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Competências da Folha</h4>
              <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                setFolhaForm({ competencia: currentMonth, proventos: 0, descontos: 0, observacoes: "" });
                setFolhaModalOpen(true);
              }}>
                <CalendarDays className="w-3 h-3" /> Registrar Folha
              </Button>
            </div>

            {loadingFolhas ? (
              <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : folhas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center space-y-1">
                <FileText className="w-6 h-6 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum lançamento de folha registrado</p>
                <p className="text-xs text-muted-foreground">Clique em "Registrar Folha" para iniciar</p>
              </div>
            ) : (
              <div className="space-y-2">
                {folhas.map((f, idx) => {
                  const isLatest = idx === 0;
                  const statusMap: Record<string, { label: string; statusValue: string }> = {
                    processada: { label: "Processada", statusValue: "aprovada" },
                    pendente: { label: "Pendente", statusValue: "pendente" },
                    pago: { label: "Paga", statusValue: "pago" },
                    fechada: { label: "Fechada", statusValue: "fechada" },
                  };
                  const st = statusMap[f.status] ?? { label: f.status, statusValue: f.status };
                  return (
                    <div key={f.id} className={`rounded-lg border p-3 space-y-2 ${isLatest ? "border-primary/40 bg-primary/5" : "bg-accent/20"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {isLatest && <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Mais recente</span>}
                          <span className="font-mono text-sm font-medium">{f.competencia}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <StatusBadge status={st.statusValue} label={st.label} />
                          {f.financeiro_gerado ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle2 className="w-3 h-3" /> Financeiro gerado
                            </span>
                          ) : (
                            <Button size="sm" variant="outline" className="gap-1 text-xs h-6 px-2" onClick={() => handleFecharFolha(f)}>
                              <DollarSign className="w-3 h-3" /> Gerar financeiro
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div><p className="text-muted-foreground">Base</p><p className="font-mono font-medium">{formatCurrency(Number(f.salario_base))}</p></div>
                        <div><p className="text-muted-foreground">Proventos</p><p className="font-mono font-medium text-green-600 dark:text-green-400">{formatCurrency(Number(f.proventos))}</p></div>
                        <div><p className="text-muted-foreground">Descontos</p><p className="font-mono font-medium text-destructive">{formatCurrency(Number(f.descontos))}</p></div>
                        <div><p className="text-muted-foreground">Líquido</p><p className="font-mono font-bold">{formatCurrency(Number(f.valor_liquido))}</p></div>
                      </div>
                      {f.observacoes && <p className="text-xs text-muted-foreground border-t pt-1">{f.observacoes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

        const tabFinanceiro = (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Lançamentos Financeiros</h4>
              {lancamentos.length > 0 && (
                <span className="text-xs text-muted-foreground">{lancamentos.length} registro{lancamentos.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            {loadingLancamentos ? (
              <div className="flex justify-center py-4"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : lancamentos.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center space-y-1">
                <DollarSign className="w-6 h-6 mx-auto text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum lançamento financeiro vinculado</p>
                <p className="text-xs text-muted-foreground">Gere financeiro a partir de uma folha registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const hoje = new Date();
                  return lancamentos.map((l) => {
                    const isPago = l.status === "pago" || l.status === "baixado";
                    const isVencido = !isPago && new Date(l.data_vencimento) < hoje;
                    return (
                      <div key={l.id} className={`rounded-lg border p-3 space-y-1 ${isVencido ? "border-destructive/40 bg-destructive/5" : isPago ? "bg-muted/20" : "bg-accent/20"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{l.descricao}</p>
                          <StatusBadge status={l.status} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <span>Venc.: <span className={`font-medium ${isVencido ? "text-destructive" : "text-foreground"}`}>{formatDate(l.data_vencimento)}</span></span>
                            {l.data_pagamento && <span>Pago: <span className="font-medium text-foreground">{formatDate(l.data_pagamento)}</span></span>}
                          </div>
                          <span className={`font-mono font-bold ${isPago ? "" : "text-foreground"}`}>{formatCurrency(Number(l.valor))}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        );

        const tabHistorico = (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm mb-3">Linha do Tempo</h4>
            <div className="relative pl-4 border-l-2 border-muted space-y-4">
              {/* Admissão */}
              <div className="relative">
                <div className="absolute -left-[1.3rem] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
                <div className="rounded-md border bg-green-500/5 border-green-500/20 p-2.5 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">Admissão</span>
                    <span className="text-xs text-muted-foreground font-mono">{formatDate(selected.data_admissao)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.cargo || "Colaborador"} — {tipoContratoLabel[selected.tipo_contrato] || selected.tipo_contrato}</p>
                </div>
              </div>

              {/* Competências de Folha */}
              {folhas.length > 0 && folhas.slice().reverse().map((f) => {
                const hasFin = f.financeiro_gerado;
                return (
                  <div key={f.id} className="relative">
                    <div className={`absolute -left-[1.3rem] top-1 w-3 h-3 rounded-full border-2 border-background ${hasFin ? "bg-blue-500" : "bg-amber-400"}`} />
                    <div className={`rounded-md border p-2.5 space-y-0.5 ${hasFin ? "bg-blue-500/5 border-blue-500/20" : "bg-amber-400/5 border-amber-400/20"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold ${hasFin ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"}`}>
                          Folha {f.competencia}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={f.status === "processada" ? "aprovada" : f.status} label={f.status === "processada" ? "Processada" : f.status === "pago" ? "Paga" : "Pendente"} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Líquido: <span className="font-mono font-medium text-foreground">{formatCurrency(Number(f.valor_liquido))}</span>
                        {hasFin && <span className="ml-2 text-blue-600 dark:text-blue-400">· Financeiro gerado</span>}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Desligamento */}
              {selected.data_demissao && (
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 w-3 h-3 rounded-full bg-destructive border-2 border-background" />
                  <div className="rounded-md border bg-destructive/5 border-destructive/20 p-2.5 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-destructive">Desligamento</span>
                      <span className="text-xs text-muted-foreground font-mono">{formatDate(selected.data_demissao)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Colaborador desligado</p>
                  </div>
                </div>
              )}

              {folhas.length === 0 && !selected.data_demissao && (
                <div className="relative">
                  <div className="absolute -left-[1.3rem] top-1 w-3 h-3 rounded-full bg-muted border-2 border-background" />
                  <p className="text-xs text-muted-foreground py-1 pl-1">Nenhuma competência de folha registrada</p>
                </div>
              )}
            </div>
          </div>
        );

        return (
          <ViewDrawerV2
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title={selected.nome}
            badge={<StatusBadge status={selected.ativo ? "Ativo" : "Inativo"} />}
            summary={drawerSummary}
            actions={<>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDrawerOpen(false); openEdit(selected); }}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{selected.ativo && folhas.length > 0 ? "Inativar" : "Excluir"}</TooltipContent>
              </Tooltip>
            </>}
            tabs={[
              { value: "resumo", label: "Resumo", content: tabResumo },
              { value: "folha", label: "Folha", content: tabFolha },
              { value: "financeiro", label: "Financeiro", content: tabFinanceiro },
              { value: "historico", label: "Histórico", content: tabHistorico },
            ]}
          />
        );
      })()}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => { setConfirmDeleteOpen(false); setDrawerOpen(false); remove(selected!.id); }}
        title={selected && folhas.length > 0 ? "Inativar Funcionário" : "Confirmar exclusão"}
        confirmLabel={selected && folhas.length > 0 ? "Inativar" : "Excluir"}
      >
        {selected && (
          <div className="space-y-3 py-1">
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="font-medium">{selected.nome}</span></div>
              {selected.cpf && <div className="flex justify-between"><span className="text-muted-foreground">CPF</span><span className="font-mono">{selected.cpf}</span></div>}
              {selected.cargo && <div className="flex justify-between"><span className="text-muted-foreground">Cargo</span><span>{selected.cargo}</span></div>}
              {folhas.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Folhas registradas</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{folhas.length} competência{folhas.length !== 1 ? "s" : ""}</span>
                </div>
              )}
              {lancamentos.length > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Lançamentos financeiros</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{lancamentos.length} lançamento{lancamentos.length !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
            {folhas.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Este funcionário possui histórico de folha. A ação irá apenas inativá-lo, preservando todos os registros.</span>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>

      {/* Folha Registration Modal */}
      <FormModal open={folhaModalOpen} onClose={() => setFolhaModalOpen(false)} title={`Registrar Folha — ${selected?.nome || ""}`}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Competência (AAAA-MM) *</Label>
            <Input type="month" value={folhaForm.competencia} onChange={e => setFolhaForm({ ...folhaForm, competencia: e.target.value })} required />
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Salário Base</p>
              <p className="font-mono font-bold text-lg">{formatCurrency(Number(selected?.salario_base || 0))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Funcionário</p>
              <p className="text-sm font-medium">{selected?.nome}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proventos Extras</Label>
              <Input type="number" step="0.01" min={0} value={folhaForm.proventos || ""} onChange={e => setFolhaForm({ ...folhaForm, proventos: Number(e.target.value) })} placeholder="Horas extras, bônus..." />
            </div>
            <div className="space-y-2">
              <Label>Descontos</Label>
              <Input type="number" step="0.01" min={0} value={folhaForm.descontos || ""} onChange={e => setFolhaForm({ ...folhaForm, descontos: Number(e.target.value) })} placeholder="Faltas, adiantamentos..." />
            </div>
          </div>
          <div className="rounded-lg border bg-primary/5 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Base</span><span className="font-mono">{formatCurrency(Number(selected?.salario_base || 0))}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>+ Proventos extras</span><span className="font-mono text-green-600 dark:text-green-400">+{formatCurrency(Number(folhaForm.proventos || 0))}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>− Descontos</span><span className="font-mono text-destructive">-{formatCurrency(Number(folhaForm.descontos || 0))}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-1 mt-1">
              <span className="text-xs font-semibold">Valor Líquido</span>
              <span className="font-mono font-bold text-lg text-primary">
                {formatCurrency(Number(selected?.salario_base || 0) + Number(folhaForm.proventos || 0) - Number(folhaForm.descontos || 0))}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground pt-0.5">Ao gerar o financeiro: salário no 5º dia e FGTS (8%) no 7º dia do mês seguinte</p>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea value={folhaForm.observacoes} onChange={e => setFolhaForm({ ...folhaForm, observacoes: e.target.value })} /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFolhaModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleFolhaSubmit}>Registrar Folha</Button>
          </div>
        </div>
      </FormModal>
    </AppLayout>
  );
}
