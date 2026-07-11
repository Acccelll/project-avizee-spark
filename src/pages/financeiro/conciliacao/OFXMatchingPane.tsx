import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Upload, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Search, Loader2, Plus, Link2, Link2Off, X, Sparkles,
  Trash2,
} from "lucide-react";
import type { OFXTransaction } from "@/lib/parseOFX";
import type { Lancamento } from "@/types/domain";
import type { ConciliacaoPersistida, Match, SugestaoPersistida } from "./types";
import { RotateCcw } from "lucide-react";

type SortKey = "data-asc" | "data-desc" | "valor-asc" | "valor-desc";

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortKey)}>
      <SelectTrigger className="h-7 w-[150px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="data-asc">Data ↑</SelectItem>
        <SelectItem value="data-desc">Data ↓</SelectItem>
        <SelectItem value="valor-asc">Valor ↑</SelectItem>
        <SelectItem value="valor-desc">Valor ↓</SelectItem>
      </SelectContent>
    </Select>
  );
}

function sortBy<T>(items: T[], key: SortKey, getDate: (i: T) => string, getValor: (i: T) => number): T[] {
  const arr = [...items];
  arr.sort((a, b) => {
    switch (key) {
      case "data-asc": return getDate(a).localeCompare(getDate(b));
      case "data-desc": return getDate(b).localeCompare(getDate(a));
      case "valor-asc": return Math.abs(getValor(a)) - Math.abs(getValor(b));
      case "valor-desc": return Math.abs(getValor(b)) - Math.abs(getValor(a));
    }
  });
  return arr;
}

interface Props {
  extratoItems: OFXTransaction[];
  lancamentos: Lancamento[];
  matches: Match[];
  showOFXPane: boolean;
  setShowOFXPane: (v: boolean | ((prev: boolean) => boolean)) => void;
  getMatch: (id: string) => Match | undefined;
  usedLancamentoIds: Set<string>;
  pareados: number;
  semParOFX: number;
  confirming: boolean;
  selectedConta: string;
  onManualMatch: (extratoId: string, lancamentoId: string) => void;
  onAbrirVincular: (extratoId: string) => void;
  onCriarInline?: (extratoId: string) => void;
  onConfirmar: () => void;
  onConfirmarSelecao: (extratoIds: string[], lancamentoIds: string[]) => boolean;
  onDesvincularExtrato: (extratoId: string) => void;
  onExcluirExtratos?: (fitids: string[]) => Promise<number> | number;
  sugestoesPersistidas?: Map<string, SugestaoPersistida>;
  onAceitarSugestao?: (extratoId: string) => boolean;
  onAceitarSugestoesPersistidas?: () => number;
  onRejeitarSugestao?: (extratoId: string) => boolean;
  conciliadosPersistidos?: Map<string, ConciliacaoPersistida>;
  onDesfazerConciliacao?: (extratoId: string) => void | Promise<boolean>;
}

export function OFXMatchingPane(p: Props) {
  const [sortExtrato, setSortExtrato] = useState<SortKey>("data-asc");
  const [sortLanc, setSortLanc] = useState<SortKey>("data-asc");
  const [selExtrato, setSelExtrato] = useState<Set<string>>(new Set());
  const [selLanc, setSelLanc] = useState<Set<string>>(new Set());
  // Onda 12 — por padrão, itens já conciliados em sessões anteriores
  // não aparecem nas pendências. Um toggle no cabeçalho permite exibi-los
  // (necessário para desfazer uma conciliação persistida).
  const [hideConciliados, setHideConciliados] = useState(true);
  const TOLERANCIA = 0.05;

  const extratoOrdenado = useMemo(
    () => sortBy(p.extratoItems, sortExtrato, (i) => i.data, (i) => i.valor),
    [p.extratoItems, sortExtrato],
  );
  const conciliadosOcultos = useMemo(() => {
    if (!p.conciliadosPersistidos || p.conciliadosPersistidos.size === 0) return 0;
    return p.extratoItems.reduce(
      (acc, item) => acc + (p.conciliadosPersistidos!.has(item.id) ? 1 : 0),
      0,
    );
  }, [p.extratoItems, p.conciliadosPersistidos]);
  const extratoVisivel = useMemo(() => {
    if (!hideConciliados || !p.conciliadosPersistidos || p.conciliadosPersistidos.size === 0) {
      return extratoOrdenado;
    }
    return extratoOrdenado.filter((item) => !p.conciliadosPersistidos!.has(item.id));
  }, [extratoOrdenado, hideConciliados, p.conciliadosPersistidos]);
  const lancamentosOrdenados = useMemo(
    () => sortBy(p.lancamentos, sortLanc, (l) => l.data_vencimento, (l) => Number(l.valor)),
    [p.lancamentos, sortLanc],
  );

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSet(next);
  };
  const totalExtratoSel = useMemo(
    () => extratoOrdenado.filter((e) => selExtrato.has(e.id)).reduce((s, e) => s + Math.abs(e.valor), 0),
    [extratoOrdenado, selExtrato],
  );
  const totalLancSel = useMemo(
    () => lancamentosOrdenados.filter((l) => selLanc.has(l.id)).reduce((s, l) => s + Math.abs(Number(l.valor)), 0),
    [lancamentosOrdenados, selLanc],
  );
  const diferenca = totalExtratoSel - totalLancSel;
  const diferencaAbs = Math.abs(diferenca);
  const podeConciliar = selExtrato.size > 0 && selLanc.size > 0 && !(selExtrato.size > 1 && selLanc.size > 1);
  const sugestoesDisponiveis = useMemo(() => {
    if (!p.sugestoesPersistidas) return 0;
    return p.extratoItems.filter((item) => {
      const sugestao = p.sugestoesPersistidas?.get(item.id);
      return !!sugestao && !p.getMatch(item.id) && !p.usedLancamentoIds.has(sugestao.lancamentoId);
    }).length;
  }, [p.extratoItems, p.getMatch, p.sugestoesPersistidas, p.usedLancamentoIds]);
  const corDif =
    diferencaAbs < 0.005 ? "text-success"
    : diferencaAbs <= TOLERANCIA ? "text-warning"
    : "text-destructive";

  const limparSelecao = () => { setSelExtrato(new Set()); setSelLanc(new Set()); };
  const handleConciliar = () => {
    if (diferencaAbs > TOLERANCIA) {
      const ok = window.confirm(
        `Diferença de ${formatCurrency(diferenca)} entre extrato e lançamentos. Conciliar mesmo assim?`,
      );
      if (!ok) return;
    }
    const ok = p.onConfirmarSelecao(Array.from(selExtrato), Array.from(selLanc));
    if (ok) limparSelecao();
  };

  return (
    <div className="mt-6 rounded-lg border border-border/60">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => p.setShowOFXPane((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted-foreground" />
          Correspondência OFX — {p.extratoItems.length} transações importadas
          <Badge variant="outline" className="text-xs font-normal">
            {p.pareados} pareados · {p.semParOFX} sem par
          </Badge>
          {sugestoesDisponiveis > 0 && (
            <Badge variant="secondary" className="text-xs font-normal gap-1">
              <Sparkles className="w-3 h-3" /> {sugestoesDisponiveis} sugestão(ões)
            </Badge>
          )}
          {conciliadosOcultos > 0 && (
            <Badge
              variant="outline"
              className="text-xs font-normal gap-1 cursor-pointer hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                setHideConciliados((v) => !v);
              }}
              title={hideConciliados ? "Mostrar conciliados" : "Ocultar conciliados"}
            >
              <CheckCircle className="w-3 h-3 text-success" />
              {conciliadosOcultos} conciliado(s) {hideConciliados ? "ocultos" : "visíveis"}
            </Badge>
          )}
        </span>
        {p.showOFXPane ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {p.showOFXPane && (
        <div className="p-4 border-t border-border/60">
          {sugestoesDisponiveis > 0 && p.onAceitarSugestoesPersistidas && (
            <div className="mb-4 rounded-lg border border-info/40 bg-info/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="w-4 h-4 text-info shrink-0" />
                <span className="font-medium">{sugestoesDisponiveis} sugestão(ões) do motor inteligente disponíveis</span>
              </div>
              <Button size="sm" variant="secondary" onClick={p.onAceitarSugestoesPersistidas} className="gap-1">
                <CheckCircle className="w-4 h-4" /> Aceitar sugestões
              </Button>
            </div>
          )}
          {/* MOBILE */}
          <div className="md:hidden mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Extrato OFX</span>
              <div className="flex items-center gap-2">
                {p.onExcluirExtratos && selExtrato.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 gap-1"
                    onClick={async () => {
                      const n = await p.onExcluirExtratos!(Array.from(selExtrato));
                      if (n > 0) setSelExtrato(new Set());
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir ({selExtrato.size})
                  </Button>
                )}
                <SortSelect value={sortExtrato} onChange={setSortExtrato} />
              </div>
            </div>
            <div className="space-y-2">
            {extratoVisivel.map((item) => {
              const match = p.getMatch(item.id);
              const isPareado = !!match;
              const linked = match ? p.lancamentos.find((l) => l.id === match.lancamentoId) : null;
              const sugestao = p.sugestoesPersistidas?.get(item.id);
              const sugestaoLanc = sugestao ? p.lancamentos.find((l) => l.id === sugestao.lancamentoId) : null;
              const podeAceitarSugestao = !!sugestao && !isPareado && !p.usedLancamentoIds.has(sugestao.lancamentoId);
              const conciliadoPersistido = p.conciliadosPersistidos?.get(item.id);
              const checked = selExtrato.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isPareado || conciliadoPersistido ? "border-success/40 bg-success/5"
                    : checked ? "border-primary bg-primary/5"
                    : "border-destructive/30 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {!isPareado && (
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(selExtrato, setSelExtrato, item.id)}
                        className="mt-1"
                        aria-label="Selecionar extrato"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.descricao || "Sem descrição"}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-sm font-mono font-semibold ${item.valor >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(item.valor)}
                      </span>
                      {isPareado ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <XCircle className="w-4 h-4 text-destructive/70" />
                      )}
                    </div>
                  </div>
                  {linked && (
                    <p className="text-xs text-success bg-success/10 rounded px-2 py-1 truncate">
                      ↔ {linked.descricao} · {formatCurrency(linked.valor)}
                    </p>
                  )}
                  {podeAceitarSugestao && sugestaoLanc && (
                    <div className="text-xs rounded px-2 py-1 border border-info/30 bg-info/5 text-muted-foreground space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate"><Sparkles className="inline w-3 h-3 mr-1 text-info" />{sugestaoLanc.descricao}</span>
                        <Badge variant="outline" className="text-[10px]">{Math.round(sugestao.score * 100)}%</Badge>
                      </div>
                      <p className="truncate">{formatCurrency(sugestaoLanc.valor)} · {formatDate(sugestaoLanc.data_vencimento)}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {isPareado ? (
                      <Button size="sm" variant="outline" className="flex-1 h-11"
                        onClick={() => p.onDesvincularExtrato(item.id)}>
                        <Link2Off className="w-4 h-4 mr-1" />
                        Desvincular
                      </Button>
                    ) : conciliadoPersistido && p.onDesfazerConciliacao ? (
                      <Button size="sm" variant="outline" className="flex-1 h-11 gap-1"
                        onClick={() => p.onDesfazerConciliacao!(item.id)}>
                        <RotateCcw className="w-4 h-4" /> Desfazer conciliação
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="flex-1 h-11 gap-2"
                          onClick={() => p.onAbrirVincular(item.id)}>
                          <Search className="w-4 h-4" /> Vincular
                        </Button>
                        {podeAceitarSugestao && p.onAceitarSugestao && (
                          <Button size="sm" variant="secondary" className="h-11 gap-1"
                            onClick={() => p.onAceitarSugestao!(item.id)}>
                            <Sparkles className="w-4 h-4" /> Aceitar
                          </Button>
                        )}
                        {podeAceitarSugestao && p.onRejeitarSugestao && (
                          <Button size="sm" variant="ghost" className="h-11 px-3"
                            onClick={() => p.onRejeitarSugestao!(item.id)} title="Rejeitar sugestão">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {p.onCriarInline && (
                          <Button size="sm" variant="secondary" className="h-11 gap-1"
                            onClick={() => p.onCriarInline!(item.id)}
                            title="Criar lançamento e baixar automaticamente">
                            <Plus className="w-4 h-4" /> Criar
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* DESKTOP split */}
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Extrato OFX ({extratoVisivel.length}
                  {conciliadosOcultos > 0 && hideConciliados ? ` de ${p.extratoItems.length}` : ""} transações)
                </h3>
                <SortSelect value={sortExtrato} onChange={setSortExtrato} />
              </div>
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {extratoVisivel.map((item) => {
                  const match = p.getMatch(item.id);
                  const isPareado = !!match;
                  const checked = selExtrato.has(item.id);
                  const linked = match ? p.lancamentos.find((l) => l.id === match.lancamentoId) : null;
                  const sugestao = p.sugestoesPersistidas?.get(item.id);
                  const sugestaoLanc = sugestao ? p.lancamentos.find((l) => l.id === sugestao.lancamentoId) : null;
                  const podeAceitarSugestao = !!sugestao && !isPareado && !p.usedLancamentoIds.has(sugestao.lancamentoId);
                  const conciliadoPersistido = p.conciliadosPersistidos?.get(item.id);
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 transition-colors ${
                      isPareado || conciliadoPersistido ? "border-success/40 bg-success/5"
                      : checked ? "border-primary bg-primary/5"
                      : "border-destructive/40 bg-destructive/5"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Checkbox
                            checked={checked}
                            disabled={isPareado || !!conciliadoPersistido}
                            onCheckedChange={() => toggle(selExtrato, setSelExtrato, item.id)}
                            aria-label="Selecionar extrato"
                          />
                          <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.descricao || "Sem descrição"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-mono font-semibold ${item.valor >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(item.valor)}
                          </span>
                          {isPareado || conciliadoPersistido ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      {isPareado && linked && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-success/10 px-2 py-1">
                          <p className="text-xs text-success truncate">
                            ↔ {linked.descricao} · {formatCurrency(linked.valor)}
                          </p>
                          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                            onClick={() => p.onDesvincularExtrato(item.id)}>
                            <Link2Off className="w-3 h-3" /> Desvincular
                          </Button>
                        </div>
                      )}
                      {!isPareado && conciliadoPersistido && p.onDesfazerConciliacao && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-success/10 px-2 py-1">
                          <p className="text-xs text-success truncate">Conciliado em sessão anterior</p>
                          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1"
                            onClick={() => p.onDesfazerConciliacao!(item.id)}>
                            <RotateCcw className="w-3 h-3" /> Desfazer
                          </Button>
                        </div>
                      )}
                      {podeAceitarSugestao && sugestaoLanc && (
                        <div className="mt-2 rounded border border-info/30 bg-info/5 px-2 py-1.5 flex items-center justify-between gap-2">
                          <div className="min-w-0 text-xs text-muted-foreground">
                            <p className="truncate font-medium">
                              <Sparkles className="inline w-3 h-3 mr-1 text-info" />
                              {sugestaoLanc.descricao}
                            </p>
                            <p className="truncate">
                              {formatCurrency(sugestaoLanc.valor)} · {formatDate(sugestaoLanc.data_vencimento)} · {Math.round(sugestao.score * 100)}%
                            </p>
                          </div>
                          {(p.onAceitarSugestao || p.onRejeitarSugestao) && (
                            <div className="flex items-center gap-1 shrink-0">
                              {p.onAceitarSugestao && (
                                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1"
                                  onClick={() => p.onAceitarSugestao!(item.id)}>
                                  <CheckCircle className="w-3 h-3" /> Aceitar
                                </Button>
                              )}
                              {p.onRejeitarSugestao && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  onClick={() => p.onRejeitarSugestao!(item.id)} title="Rejeitar sugestão">
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {!isPareado && p.onCriarInline && (
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                            onClick={() => p.onCriarInline!(item.id)}
                            title="Criar lançamento e baixar automaticamente">
                            <Plus className="w-3 h-3" /> Criar lançamento
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Lançamentos ERP ({p.lancamentos.length} no período)
                </h3>
                <SortSelect value={sortLanc} onChange={setSortLanc} />
              </div>
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {p.lancamentos.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    {p.selectedConta
                      ? "Nenhum lançamento encontrado no período."
                      : "Selecione uma conta bancária para carregar lançamentos."}
                  </p>
                ) : (
                  lancamentosOrdenados.map((l) => {
                    const isPareado = p.usedLancamentoIds.has(l.id);
                    const checked = selLanc.has(l.id);
                    return (
                      <div key={l.id} className={`rounded-lg border p-3 transition-colors ${
                        isPareado ? "border-success/40 bg-success/5"
                        : checked ? "border-primary bg-primary/5"
                        : "border-border bg-card"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Checkbox
                              checked={checked}
                              disabled={isPareado}
                              onCheckedChange={() => toggle(selLanc, setSelLanc, l.id)}
                              aria-label="Selecionar lançamento"
                            />
                            <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{l.descricao}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(l.data_vencimento)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-mono font-semibold">{formatCurrency(l.valor)}</span>
                            <Badge variant={l.tipo === "receber" ? "default" : "secondary"} className="text-[10px]">
                              {l.tipo}
                            </Badge>
                            {isPareado && <CheckCircle className="w-4 h-4 text-success" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Barra de seleção estilo TOTVS */}
          {(selExtrato.size > 0 || selLanc.size > 0) && (
            <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-wrap items-center gap-4 text-sm flex-1">
                <div>
                  <span className="text-muted-foreground">Extrato: </span>
                  <span className="font-semibold">{selExtrato.size}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono font-semibold">{formatCurrency(totalExtratoSel)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">ERP: </span>
                  <span className="font-semibold">{selLanc.size}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="font-mono font-semibold">{formatCurrency(totalLancSel)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Diferença: </span>
                  <span className={`font-mono font-semibold ${corDif}`}>{formatCurrency(diferenca)}</span>
                </div>
                {selExtrato.size > 1 && selLanc.size > 1 && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> N↔N não permitido
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={limparSelecao} className="gap-1">
                  <X className="w-4 h-4" /> Limpar
                </Button>
                <Button size="sm" disabled={!podeConciliar} onClick={handleConciliar} className="gap-1">
                  <Link2 className="w-4 h-4" /> Conciliar selecionados
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <strong>Atenção:</strong> a confirmação abaixo ainda não persiste os pares no banco de dados.
                Os lançamentos conciliados precisam ser revisados manualmente por enquanto.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Pareados: </span>
                  <span className="font-semibold text-success">{p.pareados}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sem correspondência: </span>
                  <span className="font-semibold text-destructive">{p.semParOFX}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total OFX: </span>
                  <span className="font-semibold">{p.extratoItems.length}</span>
                </div>
              </div>
              <Button onClick={p.onConfirmar} disabled={p.matches.length === 0 || p.confirming} variant="outline">
                {p.confirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                {p.confirming ? "Processando..." : "Confirmar Revisão"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}