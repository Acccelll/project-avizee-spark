import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart3, Lock, CircleDollarSign, RefreshCw, Trash2, FileText, CheckCheck, Upload, MoreHorizontal, Shuffle, FileDown } from "lucide-react";
import { toast } from "sonner";
import { ModulePage } from "@/components/ModulePage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryCard } from "@/components/SummaryCard";
import { AdvancedFilterBar, type FilterChip } from "@/components/AdvancedFilterBar";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";
import { EmptyState } from "@/components/ui/empty-state";
import { PeriodFilter, type PeriodValue } from "@/components/filters/PeriodFilter";
import { periodToDateFrom, periodToDateTo } from "@/lib/periodFilter";
import type { Period } from "@/components/filters/periodTypes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { gerarFaturaCartao } from "@/services/cartoesCredito.service";
import { ImportarFaturaCartaoDialog } from "./conciliacaoCartao/ImportarFaturaCartaoDialog";
import { ImportarFaturasLoteDialog } from "./conciliacaoCartao/ImportarFaturasLoteDialog";
import { LotesImportacaoPanel } from "./conciliacaoCartao/LotesImportacaoPanel";
import { BaixarFaturaDialog } from "./conciliacaoCartao/BaixarFaturaDialog";
import { ReconciliacaoFaturaPanel } from "./conciliacaoCartao/ReconciliacaoFaturaPanel";
import { excluirFatura } from "@/services/conciliacaoCartao/faturaLinhas.service";
import { useConfirmDestructive } from "@/hooks/useConfirmDestructive";
import { autoConciliarFaturas } from "@/services/conciliacaoCartao/autoConciliarService";
import { exportarParaExcel } from "@/services/export.service";

interface FaturaRow {
  id: string;
  cartao_id: string;
  competencia: string;
  data_fechamento: string | null;
  data_vencimento: string | null;
  valor_total: number;
  status: string;
  cartoes_credito: { nome: string; ultimos4: string | null } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const statusOptions: MultiSelectOption[] = [
  { value: "aberta", label: "Abertas" },
  { value: "fechada", label: "Fechadas" },
  { value: "paga", label: "Pagas" },
];

export default function ConciliacaoCartaoPage() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { confirm: confirmDestructive, dialog: destructiveDialog } = useConfirmDestructive({ verb: "Excluir" });
  const [cartaoFilters, setCartaoFilters] = useState<string[]>([]);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [faturaSelecionadaId, setFaturaSelecionadaId] = useState<string | null>(null);
  const [baixarOpen, setBaixarOpen] = useState(false);
  const [aba, setAba] = useState<"faturas" | "historico">("faturas");

  const cartoes = useQuery({
    queryKey: ["cartoes-credito", "ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cartoes_credito")
        .select("id, nome, ultimos4")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const faturas = useQuery({
    queryKey: ["cartao-faturas", "conciliacao-cartao", cartaoFilters, inicio, fim, statusFilters],
    queryFn: async () => {
      let q = supabase
        .from("cartao_faturas")
        .select("id, cartao_id, competencia, data_fechamento, data_vencimento, valor_total, status, cartoes_credito(nome, ultimos4)")
        .order("data_vencimento", { ascending: false })
        .limit(200);
      if (cartaoFilters.length > 0) q = q.in("cartao_id", cartaoFilters);
      if (inicio) q = q.gte("data_vencimento", inicio);
      if (fim) q = q.lte("data_vencimento", fim);
      if (statusFilters.length > 0) q = q.in("status", statusFilters);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FaturaRow[];
    },
  });

  const rawRows = faturas.data ?? [];
  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows.filter((r) => {
      const nome = r.cartoes_credito?.nome?.toLowerCase() ?? "";
      const ult = r.cartoes_credito?.ultimos4 ?? "";
      return (
        r.competencia.toLowerCase().includes(q) ||
        nome.includes(q) ||
        ult.includes(q)
      );
    });
  }, [rawRows, searchTerm]);

  const kpis = useMemo(() => {
    const abertas = rows.filter((r) => r.status === "aberta");
    const fechadas = rows.filter((r) => r.status === "fechada");
    const pagas = rows.filter((r) => r.status === "paga");
    const aPagar = [...abertas, ...fechadas].reduce((s, r) => s + Number(r.valor_total || 0), 0);
    return { abertas: abertas.length, fechadas: fechadas.length, pagas: pagas.length, aPagar };
  }, [rows]);

  const faturaSel = rows.find((r) => r.id === faturaSelecionadaId) ?? null;

  const fechar = useMutation({
    mutationFn: async (fatura: FaturaRow) => gerarFaturaCartao(fatura.cartao_id, fatura.competencia),
    onSuccess: (res, fatura) => {
      if (res.ok) {
        toast.success(`Fatura ${fatura.competencia} atualizada — total ${fmt(Number(res.valor_total ?? 0))}`);
      } else {
        toast.error(res.erro ?? "Falha ao fechar fatura");
      }
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      qc.invalidateQueries({ queryKey: ["financeiro_lancamentos"] });
    },
    onError: (err) => {
      logger.error("conciliacao_cartao.fechar", { err });
      toast.error(err instanceof Error ? err.message : "Falha ao fechar fatura");
    },
  });

  const abrirBaixar = (fatura: FaturaRow) => {
    setFaturaSelecionadaId(fatura.id);
    setBaixarOpen(true);
  };

  const excluir = useMutation({
    mutationFn: (id: string) => excluirFatura(id),
    onSuccess: (_res, id) => {
      toast.success("Fatura excluída");
      if (id === faturaSelecionadaId) setFaturaSelecionadaId(null);
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao excluir fatura"),
  });

  const limparTudo = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("cartao_faturas").select("id");
      if (error) throw error;
      let ok = 0;
      for (const f of data ?? []) {
        try { await excluirFatura(f.id); ok++; } catch (err) { logger.error("conciliacao_cartao.limpar", { err, id: f.id }); }
      }
      return { total: data?.length ?? 0, ok };
    },
    onSuccess: ({ total, ok }) => {
      toast.success(`Conciliação de cartão limpa (${ok}/${total} faturas removidas)`);
      setFaturaSelecionadaId(null);
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      qc.invalidateQueries({ queryKey: ["cartao-importacao-lotes"] });
      qc.invalidateQueries({ queryKey: ["conciliacao-cartao"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao limpar"),
  });

  const pedirLimparTudo = () => {
    void confirmDestructive(
      {
        verb: "Excluir",
        entity: "TODAS as faturas e vínculos da conciliação de cartão",
        sideEffects: [
          "Todas as faturas importadas (PDF/OFX/lote) serão removidas",
          "Todos os vínculos com lançamentos financeiros serão desfeitos",
          "Operação não pode ser revertida",
        ],
      },
      async () => { await limparTudo.mutateAsync(); },
    );
  };

  const pedirExcluir = (fatura: FaturaRow) => {
    void confirmDestructive(
      {
        verb: "Excluir",
        entity: `fatura ${fatura.competencia} · ${fatura.cartoes_credito?.nome ?? ""}`,
        sideEffects: [
          "Linhas importadas do PDF/OFX serão removidas",
          "Lançamentos financeiros vinculados perdem a referência à fatura (não são excluídos)",
        ],
      },
      async () => { await excluir.mutateAsync(fatura.id); },
    );
  };

  const activeFilterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (searchTerm)
      chips.push({ key: "search", label: "Busca", value: searchTerm, displayValue: searchTerm });
    if (cartaoFilters.length > 0) {
      const nomes = cartaoFilters
        .map((id) => cartoes.data?.find((c) => c.id === id)?.nome ?? id)
        .join(", ");
      chips.push({ key: "cartao", label: "Cartão", value: cartaoFilters, displayValue: nomes });
    }
    if (statusFilters.length > 0)
      chips.push({ key: "status", label: "Status", value: statusFilters, displayValue: statusFilters.join(", ") });
    if (inicio || fim)
      chips.push({ key: "periodo", label: "Vencimento", value: `${inicio}|${fim}`, displayValue: `${inicio || "…"} → ${fim || "…"}` });
    return chips;
  }, [searchTerm, cartaoFilters, statusFilters, inicio, fim, cartoes.data]);

  const removeFilter = (key: string) => {
    if (key === "search") setSearchTerm("");
    else if (key === "cartao") setCartaoFilters([]);
    else if (key === "status") setStatusFilters([]);
    else if (key === "periodo") { setInicio(""); setFim(""); }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setCartaoFilters([]);
    setStatusFilters([]);
    setInicio("");
    setFim("");
  };

  const cartaoOptions: MultiSelectOption[] = useMemo(
    () => (cartoes.data ?? []).map((c) => ({
      value: c.id,
      label: `${c.nome}${c.ultimos4 ? ` •••• ${c.ultimos4}` : ""}`,
    })),
    [cartoes.data],
  );

  const autoConciliar = useMutation({
    mutationFn: async () => {
      const { data: empresaId, error } = await supabase.rpc("current_empresa_id");
      if (error || !empresaId) throw new Error("Empresa não identificada");
      const faturasAlvo = rows
        .filter((r) => r.status === "aberta" || r.status === "fechada")
        .map((r) => ({ id: r.id, cartao_id: r.cartao_id }));
      if (faturasAlvo.length === 0) return { linhasAvaliadas: 0, vinculadas: 0, faturas: 0 };
      return autoConciliarFaturas({ empresa_id: empresaId as string, faturas: faturasAlvo });
    },
    onSuccess: (res) => {
      if (res.faturas === 0) {
        toast.info("Nenhuma fatura aberta/fechada no filtro atual");
        return;
      }
      toast.success(`Auto-conciliação: ${res.vinculadas}/${res.linhasAvaliadas} linhas vinculadas em ${res.faturas} faturas`);
      qc.invalidateQueries({ queryKey: ["cartao-faturas"] });
      qc.invalidateQueries({ queryKey: ["cartao-fatura-linhas"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Falha na auto-conciliação"),
  });

  const exportar = async () => {
    const excelRows = rows.map((r) => ({
      Competência: r.competencia,
      Cartão: r.cartoes_credito?.nome ?? "",
      "Últimos 4": r.cartoes_credito?.ultimos4 ?? "",
      Fechamento: r.data_fechamento ?? "",
      Vencimento: r.data_vencimento ?? "",
      "Valor total (R$)": Number(r.valor_total || 0),
      Status: r.status,
    }));
    await exportarParaExcel({ titulo: "Faturas de Cartão", rows: excelRows });
  };

  return (
    <ModulePage
      title="Conciliação de Cartão de Crédito"
      subtitle="Importe faturas em PDF, feche a competência e baixe o pagamento para conciliar no banco"
      headerActions={
        <div className="flex gap-2 items-center">
          <Button asChild variant="outline" size="sm">
            <Link to="/financeiro/conciliacao-cartao/dashboard">
              <BarChart3 className="mr-2 h-4 w-4" />Dashboard
            </Link>
          </Button>
          {!isMobile ? (
            <>
              <ImportarFaturasLoteDialog onDone={() => faturas.refetch()} />
              <ImportarFaturaCartaoDialog onImported={() => faturas.refetch()} />
              <Button
                variant="default"
                size="sm"
                onClick={() => autoConciliar.mutate()}
                disabled={autoConciliar.isPending || rows.length === 0}
              >
                <Shuffle className="mr-2 h-4 w-4" />
                {autoConciliar.isPending ? "Conciliando…" : "Conciliar automaticamente"}
              </Button>
              <Button variant="outline" size="sm" onClick={exportar} disabled={rows.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={pedirLimparTudo}
                disabled={limparTudo.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {limparTudo.isPending ? "Limpando…" : "Limpar tudo"}
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => autoConciliar.mutate()} disabled={autoConciliar.isPending || rows.length === 0}>
                  <Shuffle className="w-4 h-4 mr-2" />Conciliar automaticamente
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportar()} disabled={rows.length === 0}>
                  <FileDown className="w-4 h-4 mr-2" />Exportar Excel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={pedirLimparTudo} disabled={limparTudo.isPending} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />Limpar tudo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {!faturaSel && (
          <Tabs value={aba} onValueChange={(v) => setAba(v as typeof aba)}>
            <TabsList>
              <TabsTrigger value="faturas">Faturas</TabsTrigger>
              <TabsTrigger value="historico">Histórico de Importações</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {!faturaSel && aba === "historico" ? (
          <LotesImportacaoPanel />
        ) : (
        <>
        {!faturaSel && (
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard title="Abertas" value={kpis.abertas} subtitle="faturas em aberto" variant="warning" icon={FileText} />
            <SummaryCard title="Fechadas" value={kpis.fechadas} subtitle="prontas para baixa" variant="info" icon={Lock} />
            <SummaryCard title="Pagas" value={kpis.pagas} subtitle="já baixadas" variant="success" icon={CheckCheck} />
            <SummaryCard title="Valor a pagar" value={fmt(kpis.aPagar)} subtitle="abertas + fechadas" variant="default" icon={CircleDollarSign} />
          </div>
        )}

        {!faturaSel && (
          <div className="flex flex-wrap items-end gap-3">
            <PeriodFilter
              mode="both"
              value={{ preset: null, from: inicio || null, to: fim || null }}
              onChange={(next: PeriodValue) => {
                if (next.preset) {
                  const from = periodToDateFrom(next.preset as Period);
                  const to = periodToDateTo(next.preset as Period) ?? new Date().toISOString().slice(0, 10);
                  setInicio(from);
                  setFim(to);
                  return;
                }
                setInicio(next.from || "");
                setFim(next.to || "");
              }}
              direction="past"
            />
          </div>
        )}

        {!faturaSel && (
          <AdvancedFilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar por competência, cartão ou últimos 4..."
            activeFilters={activeFilterChips}
            onRemoveFilter={removeFilter}
            onClearAll={clearAllFilters}
            count={rows.length}
          >
            <MultiSelect
              options={cartaoOptions}
              selected={cartaoFilters}
              onChange={setCartaoFilters}
              placeholder="Cartão"
              className="w-[180px]"
            />
            <MultiSelect
              options={statusOptions}
              selected={statusFilters}
              onChange={setStatusFilters}
              placeholder="Status"
              className="w-[140px]"
            />
          </AdvancedFilterBar>
        )}

        <div className={faturaSel ? "" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"}>
          {/* Lista de faturas — só quando nenhuma está aberta */}
          {!faturaSel && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturas ({rows.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {faturas.isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : rows.length === 0 ? (
                <EmptyState
                  variant={activeFilterChips.length > 0 ? "noResults" : "firstUse"}
                  icon={Upload}
                  title={activeFilterChips.length > 0 ? "Nenhuma fatura encontrada" : "Nenhuma fatura importada"}
                  description={
                    activeFilterChips.length > 0
                      ? "Ajuste os filtros ou limpe-os para ver todas as faturas."
                      : "Importe uma fatura em PDF ou um lote para começar a conciliar."
                  }
                  action={
                    activeFilterChips.length > 0 ? (
                      <Button size="sm" variant="outline" onClick={clearAllFilters}>Limpar filtros</Button>
                    ) : (
                      <div className="flex flex-wrap gap-2 justify-center">
                        <ImportarFaturaCartaoDialog onImported={() => faturas.refetch()} />
                        <ImportarFaturasLoteDialog onDone={() => faturas.refetch()} />
                      </div>
                    )
                  }
                />
              ) : rows.map((r) => {
                const isSel = r.id === faturaSelecionadaId;
                const podeFechar = r.status === "aberta";
                const podeBaixar = r.status === "fechada";
                return (
                  <div
                    key={r.id}
                    onClick={() => setFaturaSelecionadaId(r.id)}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {r.competencia} · {r.cartoes_credito?.nome ?? "Cartão"}
                          {r.cartoes_credito?.ultimos4 ? ` •••• ${r.cartoes_credito.ultimos4}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fechamento {fmtDate(r.data_fechamento)} · Vencimento {fmtDate(r.data_vencimento)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{fmt(Number(r.valor_total || 0))}</p>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {podeFechar && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={fechar.isPending}
                          onClick={(e) => { e.stopPropagation(); fechar.mutate(r); }}
                        >
                          <Lock className="mr-1 h-3.5 w-3.5" />Fechar fatura
                        </Button>
                      )}
                      {r.status !== "paga" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={fechar.isPending}
                          onClick={(e) => { e.stopPropagation(); fechar.mutate(r); }}
                          title="Recalcular total agregando os lançamentos do período"
                        >
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />Recalcular
                        </Button>
                      )}
                      {podeBaixar && (
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); abrirBaixar(r); }}
                        >
                          <CircleDollarSign className="mr-1 h-3.5 w-3.5" />Baixar
                        </Button>
                      )}
                      {r.status !== "paga" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={excluir.isPending}
                          onClick={(e) => { e.stopPropagation(); pedirExcluir(r); }}
                          title="Excluir fatura"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />Excluir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          )}

          {/* Tela de conciliação em largura total */}
          {faturaSel ? (
            <ReconciliacaoFaturaPanel
              faturaId={faturaSel.id}
              cartaoId={faturaSel.cartao_id}
              competencia={faturaSel.competencia}
              cartaoNome={`${faturaSel.cartoes_credito?.nome ?? "Cartão"}${faturaSel.cartoes_credito?.ultimos4 ? ` •••• ${faturaSel.cartoes_credito.ultimos4}` : ""}`}
              dataFechamento={faturaSel.data_fechamento}
              dataVencimento={faturaSel.data_vencimento}
              valorTotalFatura={Number(faturaSel.valor_total || 0)}
              onBack={() => setFaturaSelecionadaId(null)}
            />
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Tela de conciliação</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Selecione uma fatura à esquerda para conciliar suas linhas com os lançamentos ERP.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        </>
        )}
      </div>

      <BaixarFaturaDialog
        open={baixarOpen}
        onOpenChange={setBaixarOpen}
        faturaId={faturaSel?.id ?? null}
        faturaLabel={faturaSel ? `${faturaSel.competencia} · ${faturaSel.cartoes_credito?.nome ?? ""}` : undefined}
        valorTotal={faturaSel ? Number(faturaSel.valor_total || 0) : undefined}
        dataVencimento={faturaSel?.data_vencimento ?? undefined}
      />
      {destructiveDialog}
    </ModulePage>
  );
}