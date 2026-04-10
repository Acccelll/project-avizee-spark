import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, RotateCcw, ShieldAlert, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { OrcamentoInternalAccess } from "@/lib/orcamentoInternalAccess";
import type { MarginStatus, RentabilidadeAnalise, InternalCostSource } from "@/lib/orcamentoRentabilidade";
import type { OrcamentoItem } from "@/components/Orcamento/OrcamentoItemsGrid";

export interface RentabilidadeScenarioConfig {
  freteSimulado: number;
  impostosSimulados: number;
  outrosCustosSimulados: number;
  descontoGlobalSimulado: number;
  reajusteGlobalPrecoPercent: number;
  reajusteGlobalCustoPercent: number;
  nomeCenario: string;
}

interface Props {
  baseAnalysis: RentabilidadeAnalise;
  scenarioAnalysis: RentabilidadeAnalise;
  items: OrcamentoItem[];
  onItemsChange: (items: OrcamentoItem[]) => void;
  scenarioConfig: RentabilidadeScenarioConfig;
  onScenarioConfigChange: (next: RentabilidadeScenarioConfig) => void;
  access: OrcamentoInternalAccess;
}

const MARGIN_LABEL: Record<MarginStatus, string> = {
  saudavel: "Saudável",
  atencao: "Atenção",
  critica: "Crítica",
  negativa: "Negativa",
  indisponivel: "Indisponível",
};

const COST_SOURCE_LABEL: Record<InternalCostSource, string> = {
  ultimo_custo_compra: "Último custo de compra",
  custo_medio: "Custo médio",
  custo_manual_cotacao: "Custo manual",
  custo_produto: "Custo do cadastro",
  indisponivel: "Sem custo",
};

function marginClass(status: MarginStatus) {
  if (status === "saudavel") return "bg-emerald-100 text-emerald-700";
  if (status === "atencao") return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

const percentFmt = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function OrcamentoInternalAnalysisPanel({
  baseAnalysis,
  scenarioAnalysis,
  items,
  onItemsChange,
  scenarioConfig,
  onScenarioConfigChange,
  access,
}: Props) {
  const [open, setOpen] = useState(false);
  const [advancedIndex, setAdvancedIndex] = useState<number | null>(null);
  const topAlerts = useMemo(() => scenarioAnalysis.alerts.slice(0, 4), [scenarioAnalysis.alerts]);

  const changedIndexes = useMemo(
    () => items.reduce<number[]>((acc, item, index) => {
      const changed = Boolean(
        item.usar_cenario ||
        item.custo_simulado != null ||
        item.preco_simulado_unitario != null ||
        item.desconto_simulado_percentual != null ||
        item.frete_rateado_simulado_unitario != null ||
        item.imposto_rateado_simulado_unitario != null ||
        item.outros_custos_simulados_unitario != null,
      );
      if (changed) acc.push(index);
      return acc;
    }, []),
    [items],
  );

  const scenarioActive = useMemo(() => {
    const globalActive = Object.entries(scenarioConfig).some(([key, value]) => key !== "nomeCenario" && Number(value || 0) !== 0);
    return globalActive || changedIndexes.length > 0;
  }, [scenarioConfig, changedIndexes.length]);

  const comparisonRows = useMemo(
    () => baseAnalysis.items.map((baseItem, idx) => ({
      base: baseItem,
      scenario: scenarioAnalysis.items[idx],
      source: items[idx],
      idx,
    })),
    [baseAnalysis.items, scenarioAnalysis.items, items],
  );

  if (!access.canViewInternalMargin) return null;

  const updateItem = (index: number, patch: Partial<OrcamentoItem>) => {
    const next = [...items];
    next[index] = { ...next[index], ...patch };
    onItemsChange(next);
  };

  const resetGlobalScenario = () => {
    onScenarioConfigChange({
      freteSimulado: 0,
      impostosSimulados: 0,
      outrosCustosSimulados: 0,
      descontoGlobalSimulado: 0,
      reajusteGlobalPrecoPercent: 0,
      reajusteGlobalCustoPercent: 0,
      nomeCenario: "",
    });
  };

  const clearAllScenario = () => {
    resetGlobalScenario();
    onItemsChange(items.map((item) => ({
      ...item,
      usar_cenario: false,
      custo_simulado: null,
      preco_simulado_unitario: null,
      desconto_simulado_percentual: null,
      frete_rateado_simulado_unitario: null,
      imposto_rateado_simulado_unitario: null,
      outros_custos_simulados_unitario: null,
      observacao_interna_margem: "",
    })));
  };

  const lucroDelta = scenarioAnalysis.resumo.lucroLiquidoEstimado - baseAnalysis.resumo.lucroLiquidoEstimado;
  const margemDelta = scenarioAnalysis.resumo.margemGeralPercentual - baseAnalysis.resumo.margemGeralPercentual;

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5 p-4 space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm">Análise Interna · Base x Cenário</h3>
          <p className="text-xs text-muted-foreground">Área interna e isolada da operação comercial (não exibida em PDF/e-mail/cliente).</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((prev) => !prev)} className="gap-1.5 shrink-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? "Ocultar" : "Exibir"}
        </Button>
      </div>

      {!!topAlerts.length && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs space-y-1">
          {topAlerts.map((alert) => (
            <p key={alert} className="flex items-center gap-1.5 text-amber-900"><TriangleAlert className="h-3.5 w-3.5" />{alert}</p>
          ))}
        </div>
      )}

      {open && (
        <>
          <div className="rounded-lg border bg-background p-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 min-w-0">
              <div className="space-y-1 min-w-0"><Label className="text-xs">Frete simulado</Label><Input type="number" value={scenarioConfig.freteSimulado} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, freteSimulado: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0"><Label className="text-xs">Impostos simulados</Label><Input type="number" value={scenarioConfig.impostosSimulados} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, impostosSimulados: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0"><Label className="text-xs">Outros custos simulados</Label><Input type="number" value={scenarioConfig.outrosCustosSimulados} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, outrosCustosSimulados: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0"><Label className="text-xs">Desconto global simulado</Label><Input type="number" value={scenarioConfig.descontoGlobalSimulado} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, descontoGlobalSimulado: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0"><Label className="text-xs">Reajuste global preço (%)</Label><Input type="number" value={scenarioConfig.reajusteGlobalPrecoPercent} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, reajusteGlobalPrecoPercent: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0"><Label className="text-xs">Reajuste global custo (%)</Label><Input type="number" value={scenarioConfig.reajusteGlobalCustoPercent} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, reajusteGlobalCustoPercent: Number(e.target.value) || 0 })} /></div>
              <div className="space-y-1 min-w-0 md:col-span-2"><Label className="text-xs">Nome do cenário</Label><Input value={scenarioConfig.nomeCenario} onChange={(e) => onScenarioConfigChange({ ...scenarioConfig, nomeCenario: e.target.value })} placeholder="Ex.: Negociação agressiva abril" /></div>
            </div>
            <div className="flex flex-wrap gap-2 min-w-0">
              <Button variant="outline" size="sm" className="min-w-0" onClick={clearAllScenario}>Limpar simulações</Button>
              <Button variant="ghost" size="sm" className="min-w-0" onClick={resetGlobalScenario}>Restaurar base</Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Venda Base</p><p className="font-semibold">{formatCurrency(baseAnalysis.resumo.vendaTotalLiquida)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Venda Cenário</p><p className="font-semibold">{formatCurrency(scenarioAnalysis.resumo.vendaTotalLiquida)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Lucro Base</p><p className="font-semibold">{formatCurrency(baseAnalysis.resumo.lucroLiquidoEstimado)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Lucro Cenário</p><p className="font-semibold">{formatCurrency(scenarioAnalysis.resumo.lucroLiquidoEstimado)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Impacto Lucro</p><p className={`font-semibold ${lucroDelta < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(lucroDelta)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Impacto Margem</p><p className={`font-semibold ${margemDelta < 0 ? "text-red-600" : "text-emerald-600"}`}>{percentFmt.format(margemDelta)}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Itens alterados</p><p className="font-semibold">{changedIndexes.length}</p></div>
            <div className="rounded-lg border bg-background p-3"><p className="text-xs text-muted-foreground">Cenário ativo</p><p className="font-semibold">{scenarioActive ? "Sim" : "Não"}</p></div>
          </div>

          <div className="overflow-x-auto border rounded-lg bg-background">
            <table className="w-full min-w-[1500px] text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-2 text-left" colSpan={4}>BASE</th>
                  <th className="p-2 text-left bg-primary/5" colSpan={5}>CENÁRIO</th>
                  <th className="p-2 text-left" colSpan={8}>RESULTADO</th>
                </tr>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="text-left p-2">Item</th>
                  <th className="text-right p-2">Custo Base</th>
                  <th className="text-right p-2">Preço Base</th>
                  <th className="text-right p-2">Desc. Base</th>
                  <th className="text-right p-2 bg-primary/5">Custo Cenário</th>
                  <th className="text-right p-2 bg-primary/5">Preço Cenário</th>
                  <th className="text-right p-2 bg-primary/5">Desc. Cenário</th>
                  <th className="text-center p-2 bg-primary/5">Ativo</th>
                  <th className="text-center p-2 bg-primary/5">Detalhar</th>
                  <th className="text-right p-2">Lucro Base</th>
                  <th className="text-right p-2">Lucro Cenário</th>
                  <th className="text-right p-2">Margem Base</th>
                  <th className="text-right p-2">Margem Cenário</th>
                  <th className="text-right p-2">Delta Lucro</th>
                  <th className="text-right p-2">Delta Margem</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-center p-2">Restaurar</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ base, scenario, source, idx }) => {
                  const simulado = Boolean(source.usar_cenario || source.custo_simulado != null || source.preco_simulado_unitario != null || source.desconto_simulado_percentual != null);
                  const itemDeltaLucro = (scenario.lucroTotal ?? 0) - (base.lucroTotal ?? 0);
                  const itemDeltaMargem = (scenario.margemPercentual ?? 0) - (base.margemPercentual ?? 0);
                  return (
                    <tr key={`${base.produtoId}-${idx}`} className="border-b last:border-0 align-top">
                      <td className="p-2 min-w-[260px]">
                        <p className="font-medium">{base.descricao}</p>
                        <p className="text-muted-foreground">{base.quantidade} un. · {COST_SOURCE_LABEL[base.custoSource]}</p>
                        {simulado && <Badge variant="secondary" className="mt-1 bg-primary/15 text-primary">Simulado</Badge>}
                      </td>
                      <td className="p-2 text-right">{base.custoFinalUnitario == null ? "—" : formatCurrency(base.custoFinalUnitario)}</td>
                      <td className="p-2 text-right">{formatCurrency(base.precoVendaUnitario)}</td>
                      <td className="p-2 text-right">{percentFmt.format((source.desconto_percentual || 0) / 100)}</td>
                      <td className="p-2 bg-primary/5"><Input type="number" className="h-8 text-right" value={source.custo_simulado ?? ""} placeholder={base.custoFinalUnitario?.toString() || "0"} onChange={(e) => updateItem(idx, { custo_simulado: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></td>
                      <td className="p-2 bg-primary/5"><Input type="number" className="h-8 text-right" value={source.preco_simulado_unitario ?? ""} placeholder={base.precoVendaUnitario.toString()} onChange={(e) => updateItem(idx, { preco_simulado_unitario: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></td>
                      <td className="p-2 bg-primary/5"><Input type="number" className="h-8 text-right" value={source.desconto_simulado_percentual ?? ""} placeholder={(source.desconto_percentual || 0).toString()} onChange={(e) => updateItem(idx, { desconto_simulado_percentual: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></td>
                      <td className="p-2 text-center bg-primary/5"><div className="flex justify-center"><Switch checked={Boolean(source.usar_cenario)} onCheckedChange={(checked) => updateItem(idx, { usar_cenario: checked })} /></div></td>
                      <td className="p-2 text-center bg-primary/5"><Button variant="ghost" size="sm" className="h-8" onClick={() => setAdvancedIndex(idx)}><SlidersHorizontal className="h-3.5 w-3.5" /></Button></td>
                      <td className="p-2 text-right">{base.lucroTotal == null ? "—" : formatCurrency(base.lucroTotal)}</td>
                      <td className="p-2 text-right">{scenario.lucroTotal == null ? "—" : formatCurrency(scenario.lucroTotal)}</td>
                      <td className="p-2 text-right">{base.margemPercentual == null ? "—" : percentFmt.format(base.margemPercentual)}</td>
                      <td className="p-2 text-right">{scenario.margemPercentual == null ? "—" : percentFmt.format(scenario.margemPercentual)}</td>
                      <td className={`p-2 text-right ${itemDeltaLucro < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(itemDeltaLucro)}</td>
                      <td className={`p-2 text-right ${itemDeltaMargem < 0 ? "text-red-600" : "text-emerald-600"}`}>{percentFmt.format(itemDeltaMargem)}</td>
                      <td className="p-2"><Badge variant="secondary" className={marginClass(scenario.margemStatus)}>{MARGIN_LABEL[scenario.margemStatus]}</Badge></td>
                      <td className="p-2 text-center"><Button variant="ghost" size="sm" className="h-8" onClick={() => updateItem(idx, { usar_cenario: false, custo_simulado: null, preco_simulado_unitario: null, desconto_simulado_percentual: null, frete_rateado_simulado_unitario: null, imposto_rateado_simulado_unitario: null, outros_custos_simulados_unitario: null, observacao_interna_margem: "" })}><RotateCcw className="h-3.5 w-3.5" /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-background p-3 text-xs">
            <p className="font-medium mb-1 flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" />Resumo interno da cotação e cenário</p>
            <p className="text-muted-foreground">Simulação interna isolada: não altera cadastro de produto, nem fluxo de pedido, financeiro, estoque, faturamento, PDF ou e-mail.</p>
          </div>

          <Dialog open={advancedIndex != null} onOpenChange={(value) => !value && setAdvancedIndex(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Simulação avançada do item</DialogTitle></DialogHeader>
              {advancedIndex != null && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Custo cenário</Label><Input type="number" value={items[advancedIndex]?.custo_simulado ?? ""} onChange={(e) => updateItem(advancedIndex, { custo_simulado: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Preço cenário</Label><Input type="number" value={items[advancedIndex]?.preco_simulado_unitario ?? ""} onChange={(e) => updateItem(advancedIndex, { preco_simulado_unitario: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Desconto cenário (%)</Label><Input type="number" value={items[advancedIndex]?.desconto_simulado_percentual ?? ""} onChange={(e) => updateItem(advancedIndex, { desconto_simulado_percentual: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Frete cenário do item</Label><Input type="number" value={items[advancedIndex]?.frete_rateado_simulado_unitario ?? ""} onChange={(e) => updateItem(advancedIndex, { frete_rateado_simulado_unitario: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Imposto cenário do item</Label><Input type="number" value={items[advancedIndex]?.imposto_rateado_simulado_unitario ?? ""} onChange={(e) => updateItem(advancedIndex, { imposto_rateado_simulado_unitario: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Outros custos cenário do item</Label><Input type="number" value={items[advancedIndex]?.outros_custos_simulados_unitario ?? ""} onChange={(e) => updateItem(advancedIndex, { outros_custos_simulados_unitario: e.target.value === "" ? null : Number(e.target.value), usar_cenario: true })} /></div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Observação interna do cenário</Label>
                    <Textarea value={items[advancedIndex]?.observacao_interna_margem || ""} onChange={(e) => updateItem(advancedIndex, { observacao_interna_margem: e.target.value, usar_cenario: true })} />
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </Card>
  );
}
