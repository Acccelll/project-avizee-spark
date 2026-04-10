import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ModulePage } from "@/components/ModulePage";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { ViewDrawer } from "@/components/ViewDrawer";
import { SummaryCard } from "@/components/SummaryCard";
import { useSupabaseCrud } from "@/hooks/useSupabaseCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, ArrowUpDown, Building2 } from "lucide-react";

interface CaixaMov {
  id: string; tipo: string; descricao: string; valor: number;
  saldo_anterior: number; saldo_atual: number; created_at: string;
  conta_bancaria_id: string | null; forma_pagamento: string | null;
}

interface ContaBancaria {
  id: string; descricao: string; saldo_atual: number; ativo: boolean;
  bancos?: { nome: string };
}

const Caixa = () => {
  const { data, loading, create } = useSupabaseCrud<CaixaMov>({ table: "caixa_movimentos", hasAtivo: false });
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<CaixaMov | null>(null);
  const [form, setForm] = useState({ tipo: "suprimento", descricao: "", valor: 0, conta_bancaria_id: "", forma_pagamento: "" });
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [selectedConta, setSelectedConta] = useState("geral");

  useEffect(() => {
    const loadContas = async () => {
      const { data: contas } = await supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true);
      setContasBancarias((contas as any[]) || []);
    };
    loadContas();
  }, []);

  // Saldo calculation
  const saldoGeral = useMemo(() => {
    return contasBancarias.reduce((sum, c) => sum + Number(c.saldo_atual || 0), 0);
  }, [contasBancarias]);

  const saldoConta = useMemo(() => {
    if (selectedConta === "geral") return saldoGeral;
    const conta = contasBancarias.find(c => c.id === selectedConta);
    return conta ? Number(conta.saldo_atual || 0) : 0;
  }, [selectedConta, contasBancarias, saldoGeral]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let entradasHoje = 0, saidasHoje = 0, movHoje = 0;
    const relevantData = selectedConta === "geral" ? data : data.filter(m => m.conta_bancaria_id === selectedConta);
    relevantData.forEach(m => {
      if (m.created_at.startsWith(today)) {
        movHoje++;
        const positive = ["abertura", "suprimento", "venda"].includes(m.tipo);
        if (positive) entradasHoje += Number(m.valor);
        else saidasHoje += Number(m.valor);
      }
    });
    return { entradasHoje, saidasHoje, movHoje };
  }, [data, selectedConta]);

  const filteredData = useMemo(() => {
    let result = data;
    if (selectedConta !== "geral") result = result.filter(m => m.conta_bancaria_id === selectedConta);
    if (filterTipo !== "todos") result = result.filter(m => m.tipo === filterTipo);
    return result;
  }, [data, selectedConta, filterTipo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descricao || !form.valor) { toast.error("Descrição e valor são obrigatórios"); return; }
    if (!form.conta_bancaria_id) { toast.error("Conta/Caixa é obrigatória"); return; }
    setSaving(true);
    try {
      const conta = contasBancarias.find(c => c.id === form.conta_bancaria_id);
      const saldoAnterior = conta ? Number(conta.saldo_atual || 0) : 0;
      const isPositive = ["abertura", "suprimento", "venda"].includes(form.tipo);
      const saldo_atual = isPositive ? saldoAnterior + form.valor : saldoAnterior - form.valor;
      await create({
        ...form,
        saldo_anterior: saldoAnterior,
        saldo_atual,
        conta_bancaria_id: form.conta_bancaria_id,
        forma_pagamento: form.forma_pagamento || null,
      } as any);
      // Update conta bancaria saldo
      await supabase.from("contas_bancarias").update({ saldo_atual } as any).eq("id", form.conta_bancaria_id);
      setModalOpen(false);
      setForm({ tipo: "suprimento", descricao: "", valor: 0, conta_bancaria_id: "", forma_pagamento: "" });
      // Refresh contas
      const { data: contas } = await supabase.from("contas_bancarias").select("*, bancos(nome)").eq("ativo", true);
      setContasBancarias((contas as any[]) || []);
    } catch (err) {
      console.error('[caixa] erro ao salvar:', err);
      toast.error("Erro ao registrar movimentação");
    }
    setSaving(false);
  };

  const typeLabels: Record<string, string> = {
    abertura: "Abertura", suprimento: "Suprimento", sangria: "Sangria",
    fechamento: "Fechamento", venda: "Venda", pagamento: "Pagamento",
  };

  const getContaLabel = (contaId: string | null) => {
    if (!contaId) return "—";
    const conta = contasBancarias.find(c => c.id === contaId);
    return conta ? `${conta.bancos?.nome || ""} - ${conta.descricao}` : "—";
  };

  const columns = [
    { key: "tipo", label: "Tipo", render: (m: CaixaMov) => typeLabels[m.tipo] || m.tipo },
    { key: "descricao", label: "Descrição" },
    { key: "conta", label: "Banco/Conta", render: (m: CaixaMov) => <span className="text-xs">{getContaLabel(m.conta_bancaria_id)}</span> },
    { key: "forma_pagamento", label: "Forma", render: (m: CaixaMov) => m.forma_pagamento || "—" },
    { key: "valor", label: "Valor", render: (m: CaixaMov) => {
      const positive = ["abertura", "suprimento", "venda"].includes(m.tipo);
      return <span className={positive ? "text-success font-semibold" : "text-destructive font-semibold"}>
        {positive ? "+" : "-"}{formatCurrency(Number(m.valor))}
      </span>;
    }},
    { key: "saldo_atual", label: "Saldo", render: (m: CaixaMov) => <span className="font-semibold mono">{formatCurrency(Number(m.saldo_atual))}</span> },
    { key: "created_at", label: "Data/Hora", render: (m: CaixaMov) => new Date(m.created_at).toLocaleString("pt-BR") },
  ];

  return (
    <AppLayout>
      <ModulePage title="Caixa" subtitle="Movimentações e controle de caixa" addLabel="Nova Movimentação" onAdd={() => setModalOpen(true)} count={filteredData.length}>

        {/* Account selector pills */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <Button size="sm" variant={selectedConta === "geral" ? "default" : "outline"} onClick={() => setSelectedConta("geral")} className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Geral
          </Button>
          {contasBancarias.map(c => (
            <Button key={c.id} size="sm" variant={selectedConta === c.id ? "default" : "outline"} onClick={() => setSelectedConta(c.id)} className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {c.bancos?.nome} - {c.descricao}
            </Button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard title="Saldo Atual" value={formatCurrency(saldoConta)} icon={Wallet} variant={saldoConta >= 0 ? "success" : "danger"} />
          <SummaryCard title="Entradas Hoje" value={formatCurrency(kpis.entradasHoje)} icon={TrendingUp} variant="success" />
          <SummaryCard title="Saídas Hoje" value={formatCurrency(kpis.saidasHoje)} icon={TrendingDown} variant="danger" />
          <SummaryCard title="Mov. Hoje" value={kpis.movHoje.toString()} icon={ArrowUpDown} variant="info" />
        </div>

        {/* Saldos por conta — visible only in "Geral" view */}
        {selectedConta === "geral" && contasBancarias.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {contasBancarias.map(c => (
              <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedConta(c.id)}>
                <CardContent className="p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{c.bancos?.nome} - {c.descricao}</p>
                  <p className={`text-lg font-bold mt-1 ${Number(c.saldo_atual) >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(Number(c.saldo_atual || 0))}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Type filter */}
        <div className="flex gap-1 mb-4 flex-wrap">
          {["todos", "abertura", "suprimento", "sangria", "venda", "pagamento", "fechamento"].map(t => (
            <Button key={t} size="sm" variant={filterTipo === t ? "default" : "outline"} onClick={() => setFilterTipo(t)}>
              {t === "todos" ? "Todos" : typeLabels[t] || t}
            </Button>
          ))}
        </div>

        <DataTable columns={columns} data={filteredData} loading={loading}
          onView={(m) => { setSelected(m); setDrawerOpen(true); }} />
      </ModulePage>

      <FormModal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Movimentação de Caixa" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertura">Abertura</SelectItem>
                <SelectItem value="suprimento">Suprimento</SelectItem>
                <SelectItem value="sangria">Sangria</SelectItem>
                <SelectItem value="venda">Venda</SelectItem>
                <SelectItem value="pagamento">Pagamento</SelectItem>
                <SelectItem value="fechamento">Fechamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Conta/Caixa *</Label>
            <Select value={form.conta_bancaria_id || "none"} onValueChange={(v) => setForm({ ...form, conta_bancaria_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione conta..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                {contasBancarias.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.bancos?.nome} - {c.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Forma de Pagamento</Label>
            <Select value={form.forma_pagamento || "none"} onValueChange={(v) => setForm({ ...form, forma_pagamento: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione...</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Descrição *</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required /></div>
          <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} required /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
          </div>
        </form>
      </FormModal>

      <ViewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Detalhes da Movimentação">
        {selected && (
          <div className="space-y-3">
            <div><span className="text-xs text-muted-foreground">Tipo</span><p>{typeLabels[selected.tipo]}</p></div>
            <div><span className="text-xs text-muted-foreground">Banco/Conta</span><p>{getContaLabel(selected.conta_bancaria_id)}</p></div>
            <div><span className="text-xs text-muted-foreground">Forma de Pagamento</span><p>{selected.forma_pagamento || "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">Descrição</span><p className="font-medium">{selected.descricao}</p></div>
            <div><span className="text-xs text-muted-foreground">Valor</span><p className="font-semibold">{formatCurrency(Number(selected.valor))}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-xs text-muted-foreground">Saldo Anterior</span><p>{formatCurrency(Number(selected.saldo_anterior))}</p></div>
              <div><span className="text-xs text-muted-foreground">Saldo Atual</span><p className="font-semibold">{formatCurrency(Number(selected.saldo_atual))}</p></div>
            </div>
          </div>
        )}
      </ViewDrawer>
    </AppLayout>
  );
};

export default Caixa;
