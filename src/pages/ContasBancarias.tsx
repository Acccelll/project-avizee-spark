import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { ContaBancariaDrawer } from "@/components/financeiro/ContaBancariaDrawer";
import { AdvancedFilterBar } from "@/components/AdvancedFilterBar";
import type { FilterChip } from "@/components/AdvancedFilterBar";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet, Landmark, AlertTriangle, ShieldAlert,
  CheckCircle, Ban, Building2,
} from "lucide-react";

interface Banco { id: string; nome: string; tipo: string; ativo: boolean; }
interface ContaBancaria {
  id: string; banco_id: string; descricao: string; agencia: string; conta: string;
  titular: string; saldo_atual: number; ativo: boolean;
  bancos?: { nome: string; tipo: string };
}

interface InUseCounts {
  lancamentos: number;
  baixas: number;
  caixaMovs: number;
}

const tipoContaLabel: Record<string, string> = {
  corrente: "Conta Corrente",
  poupanca: "Poupança",
  investimento: "Investimento",
  caixa: "Caixa",
};

function getTipoLabel(tipo: string | undefined) {
  if (!tipo) return "—";
  return tipoContaLabel[tipo.toLowerCase()] ?? tipo;
}

const ContasBancarias = () => {
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<ContaBancaria | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ banco_id: "", descricao: "", agencia: "", conta: "", titular: "", saldo_atual: 0, ativo: true });
  const [inUseCounts, setInUseCounts] = useState<InUseCounts>({ lancamentos: 0, baixas: 0, caixaMovs: 0 });
  const [confirmInactivate, setConfirmInactivate] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tipoFilters, setTipoFilters] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from("bancos").select("*").eq("ativo", true).order("nome"),
      supabase.from("contas_bancarias").select("*, bancos(nome, tipo)").order("created_at", { ascending: false }),
    ]);
    setBancos(b || []);
    setContas(c || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Derived summaries
  const contasAtivas = useMemo(() => contas.filter((c) => c.ativo), [contas]);
  const contasInativas = useMemo(() => contas.length - contasAtivas.length, [contas, contasAtivas]);
  const saldoTotal = useMemo(
    () => contasAtivas.reduce((s, c) => s + Number(c.saldo_atual || 0), 0),
    [contasAtivas],
  );

  // Filter options derived from loaded accounts (same source as filtering logic)
  const tipoOptions = useMemo<MultiSelectOption[]>(() => {
    const tipos = new Set(
      contas.map((c) => c.bancos?.tipo).filter(Boolean) as string[],
    );
    return Array.from(tipos).map((t) => ({ value: t, label: getTipoLabel(t) }));
  }, [contas]);

  const statusOptions: MultiSelectOption[] = [
    { label: "Ativa", value: "ativo" },
    { label: "Inativa", value: "inativo" },
  ];

  // Client-side filtered data
  const filteredData = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return contas.filter((c) => {
      if (statusFilters.length > 0) {
        if (!statusFilters.includes(c.ativo ? "ativo" : "inativo")) return false;
      }
      if (tipoFilters.length > 0) {
        if (!tipoFilters.includes(c.bancos?.tipo || "")) return false;
      }
      if (!q) return true;
      return (
        c.descricao.toLowerCase().includes(q) ||
        (c.bancos?.nome || "").toLowerCase().includes(q) ||
        (c.agencia || "").toLowerCase().includes(q) ||
        (c.conta || "").toLowerCase().includes(q) ||
        (c.titular || "").toLowerCase().includes(q)
      );
    });
  }, [contas, searchTerm, statusFilters, tipoFilters]);

  // Active filter chips for the filter bar
  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    statusFilters.forEach((v) =>
      chips.push({ key: "status", label: "Status", value: v, displayValue: v === "ativo" ? "Ativa" : "Inativa" }),
    );
    tipoFilters.forEach((v) =>
      chips.push({ key: "tipo", label: "Tipo", value: v, displayValue: getTipoLabel(v) }),
    );
    return chips;
  }, [statusFilters, tipoFilters]);

  const handleRemoveFilter = (key: string, value?: string) => {
    if (key === "status") setStatusFilters((prev) => prev.filter((v) => v !== value));
    if (key === "tipo") setTipoFilters((prev) => prev.filter((v) => v !== value));
  };

  const openCreate = () => {
    setMode("create");
    setForm({ banco_id: "", descricao: "", agencia: "", conta: "", titular: "", saldo_atual: 0, ativo: true });
    setInUseCounts({ lancamentos: 0, baixas: 0, caixaMovs: 0 });
    setModalOpen(true);
  };

  const openEdit = async (c: ContaBancaria) => {
    setMode("edit");
    setSelected(c);
    setForm({
      banco_id: c.banco_id,
      descricao: c.descricao,
      agencia: c.agencia || "",
      conta: c.conta || "",
      titular: c.titular || "",
      saldo_atual: c.saldo_atual || 0,
      ativo: c.ativo,
    });
    const [{ count: lCount }, { count: bCount }, { count: cCount }] = await Promise.all([
      supabase.from("financeiro_lancamentos").select("id", { count: "exact", head: true }).eq("conta_bancaria_id", c.id).eq("ativo", true),
      supabase.from("financeiro_baixas" as any).select("id", { count: "exact", head: true }).eq("conta_bancaria_id", c.id),
      supabase.from("caixa_movimentos").select("id", { count: "exact", head: true }).eq("conta_bancaria_id", c.id),
    ]);
    setInUseCounts({ lancamentos: lCount ?? 0, baixas: bCount ?? 0, caixaMovs: cCount ?? 0 });
    setModalOpen(true);
  };

  const persistCreate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("contas_bancarias").insert({
        banco_id: form.banco_id,
        descricao: form.descricao,
        agencia: form.agencia || null,
        conta: form.conta || null,
        titular: form.titular || null,
        saldo_atual: form.saldo_atual,
      });
      if (error) throw error;
      toast.success("Conta criada com sucesso!");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) { console.error('[contas-bancarias]', err); toast.error("Erro ao salvar conta bancária."); }
    setSaving(false);
  };

  const persistUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contas_bancarias").update({
        descricao: form.descricao.trim(),
        banco_id: form.banco_id,
        agencia: form.agencia.trim() || null,
        conta: form.conta.trim() || null,
        titular: form.titular.trim() || null,
        ativo: form.ativo,
      }).eq("id", selected.id);
      if (error) throw error;
      toast.success("Conta bancária atualizada com sucesso!");
      setModalOpen(false);
      fetchData();
    } catch (err: unknown) { console.error('[contas-bancarias]', err); toast.error("Erro ao salvar conta bancária."); }
    setSaving(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.banco_id || !form.descricao) { toast.error("Banco e descrição são obrigatórios"); return; }
    if (mode === "edit" && selected) {
      const willDeactivate = !form.ativo && selected.ativo;
      const inUse = inUseCounts.lancamentos > 0 || inUseCounts.baixas > 0 || inUseCounts.caixaMovs > 0;
      if (willDeactivate && inUse) { setConfirmInactivate(true); return; }
      await persistUpdate();
    } else {
      await persistCreate();
    }
  };

  const handleDelete = async (c: ContaBancaria) => {
    const { error } = await supabase.from("contas_bancarias").update({ ativo: false }).eq("id", c.id);
    if (error) { toast.error("Erro ao remover conta."); return; }
    toast.success("Conta removida!");
    fetchData();
  };

  const willDeactivate = mode === "edit" && selected && !form.ativo && selected.ativo;
  const inUse = inUseCounts.lancamentos > 0 || inUseCounts.baixas > 0 || inUseCounts.caixaMovs > 0;

  const columns = [
    {
      key: "descricao", label: "Conta Bancária", sortable: true,
      render: (c: ContaBancaria) => (
        <div className="flex items-center gap-2">
          <Landmark className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium leading-tight">{c.descricao}</p>
            {c.bancos?.nome && <p className="text-xs text-muted-foreground">{c.bancos.nome}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "banco", label: "Banco", sortable: true, hidden: true,
      render: (c: ContaBancaria) => <span className="text-sm">{c.bancos?.nome || "—"}</span>,
    },
    {
      key: "tipo", label: "Tipo de Conta",
      render: (c: ContaBancaria) => (
        <span className="text-xs font-medium">{getTipoLabel(c.bancos?.tipo)}</span>
      ),
    },
    {
      key: "agencia_conta", label: "Ag / Conta",
      render: (c: ContaBancaria) => (
        <span className="font-mono text-xs">
          {c.agencia ? `${c.agencia} / ${c.conta || "—"}` : (c.conta || "—")}
        </span>
      ),
    },
    {
      key: "titular", label: "Titular", hidden: true,
      render: (c: ContaBancaria) => c.titular
        ? <span className="text-sm">{c.titular}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "saldo", label: "Saldo Atual", sortable: true,
      render: (c: ContaBancaria) => (
        <span className={`font-semibold font-mono text-sm ${Number(c.saldo_atual || 0) >= 0 ? "text-success" : "text-destructive"}`}>
          {formatCurrency(Number(c.saldo_atual || 0))}
        </span>
      ),
    },
    {
      key: "ativo", label: "Status",
      render: (c: ContaBancaria) => (
        <StatusBadge status={c.ativo ? "ativo" : "inativo"} />
      ),
    },
    {
      key: "uso", label: "Uso Operacional", hidden: true,
      render: (c: ContaBancaria) => (
        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
          {c.ativo ? <CheckCircle className="w-3 h-3 text-success" /> : <Ban className="w-3 h-3" />}
          {c.ativo ? "Disponível" : "Inativa"}
        </Badge>
      ),
    },
  ];

  return (
    <AppLayout>
      <ModulePage
        title="Contas Bancárias"
        subtitle="Central de consulta e gestão das contas financeiras da empresa"
        addLabel="Nova Conta"
        onAdd={openCreate}
        summaryCards={
          <>
            <StatCard title="Total de Contas" value={String(contas.length)} icon={Building2} />
            <StatCard title="Ativas" value={String(contasAtivas.length)} icon={CheckCircle} iconColor="text-success" />
            <StatCard title="Inativas" value={String(contasInativas)} icon={Ban} />
            <StatCard
              title="Saldo Total"
              value={formatCurrency(saldoTotal)}
              icon={Wallet}
              iconColor={saldoTotal >= 0 ? "text-success" : "text-destructive"}
            />
          </>
        }
      >
        <AdvancedFilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por nome, banco, agência, conta ou titular..."
          activeFilters={activeFilterChips}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={() => { setStatusFilters([]); setTipoFilters([]); }}
          count={filteredData.length}
        >
          <MultiSelect
            options={statusOptions}
            selected={statusFilters}
            onChange={setStatusFilters}
            placeholder="Status"
            className="w-[130px]"
          />
          {tipoOptions.length > 0 && (
            <MultiSelect
              options={tipoOptions}
              selected={tipoFilters}
              onChange={setTipoFilters}
              placeholder="Tipo"
              className="w-[130px]"
            />
          )}
        </AdvancedFilterBar>

        <DataTable
          columns={columns}
          data={filteredData}
          loading={loading}
          moduleKey="contas-bancarias"
          showColumnToggle={true}
          onView={(c) => { setSelected(c); setDrawerOpen(true); }}
          onEdit={openEdit}
          onDelete={handleDelete}
          emptyTitle="Nenhuma conta bancária encontrada"
          emptyDescription="Cadastre uma nova conta ou ajuste os filtros de busca."
        />
      </ModulePage>

      <FormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === "create" ? "Nova Conta Bancária" : "Editar Conta Bancária"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Banco *</Label>
              <Select value={form.banco_id} onValueChange={(v) => setForm({ ...form, banco_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {bancos.map(b => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Conta Corrente Principal" required /></div>
            <div className="space-y-2"><Label>Agência</Label><Input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} /></div>
            <div className="space-y-2"><Label>Conta</Label><Input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} /></div>
            <div className="space-y-2"><Label>Titular</Label><Input value={form.titular} onChange={e => setForm({ ...form, titular: e.target.value })} /></div>
            {mode === "create" && (
              <div className="space-y-2"><Label>Saldo Inicial</Label><Input type="number" step="0.01" value={form.saldo_atual} onChange={e => setForm({ ...form, saldo_atual: Number(e.target.value) })} /></div>
            )}
          </div>
          {mode === "edit" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="edit-ativo" className="text-sm font-medium cursor-pointer">Conta ativa</Label>
                  <p className="text-xs text-muted-foreground">Contas inativas não aparecem para seleção em lançamentos</p>
                </div>
                <Switch id="edit-ativo" checked={form.ativo} onCheckedChange={(checked) => setForm({ ...form, ativo: checked })} />
              </div>
              {willDeactivate && inUse && (
                <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-1">
                    <p className="font-semibold">Esta conta está em uso no sistema</p>
                    <p>
                      Foram encontrados{" "}
                      {inUseCounts.lancamentos > 0 && `${inUseCounts.lancamentos} lançamento(s)`}
                      {inUseCounts.lancamentos > 0 && inUseCounts.baixas > 0 && ", "}
                      {inUseCounts.baixas > 0 && `${inUseCounts.baixas} baixa(s)`}
                      {(inUseCounts.lancamentos > 0 || inUseCounts.baixas > 0) && inUseCounts.caixaMovs > 0 && " e "}
                      {inUseCounts.caixaMovs > 0 && `${inUseCounts.caixaMovs} movimento(s) de caixa`}
                      {" "}vinculados a esta conta.
                    </p>
                    <p>Ao salvar, você será solicitado a confirmar a inativação.</p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </FormModal>

      <AlertDialog open={confirmInactivate} onOpenChange={setConfirmInactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Confirmar inativação da conta
            </AlertDialogTitle>
            <AlertDialogDescription className="sr-only">Confirmar inativação</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2 space-y-2 text-sm">
            <p>A conta <strong>{selected?.descricao}</strong> ({selected?.bancos?.nome ?? "—"}) está vinculada a:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {inUseCounts.lancamentos > 0 && <li>{inUseCounts.lancamentos} lançamento(s) financeiro(s)</li>}
              {inUseCounts.baixas > 0 && <li>{inUseCounts.baixas} baixa(s) registrada(s)</li>}
              {inUseCounts.caixaMovs > 0 && <li>{inUseCounts.caixaMovs} movimento(s) de caixa</li>}
            </ul>
            <p className="font-medium text-foreground">
              Deseja realmente inativar esta conta? Os vínculos existentes não serão removidos,
              mas a conta deixará de aparecer para novos lançamentos.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmInactivate(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await persistUpdate(); setConfirmInactivate(false); }}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirmar inativação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ContaBancariaDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selected={selected}
        onEdit={(c) => openEdit(c)}
        onDelete={(c) => handleDelete(c)}
      />
    </AppLayout>
  );
};

export default ContasBancarias;
