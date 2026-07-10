import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Upload, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Search, Loader2, Plus,
} from "lucide-react";
import type { OFXTransaction } from "@/lib/parseOFX";
import type { Lancamento } from "@/types/domain";
import type { Match } from "./types";

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
}

export function OFXMatchingPane(p: Props) {
  const [sortExtrato, setSortExtrato] = useState<SortKey>("data-asc");
  const [sortLanc, setSortLanc] = useState<SortKey>("data-asc");
  const extratoOrdenado = useMemo(
    () => sortBy(p.extratoItems, sortExtrato, (i) => i.data, (i) => i.valor),
    [p.extratoItems, sortExtrato],
  );
  const lancamentosOrdenados = useMemo(
    () => sortBy(p.lancamentos, sortLanc, (l) => l.data_vencimento, (l) => Number(l.valor)),
    [p.lancamentos, sortLanc],
  );
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
        </span>
        {p.showOFXPane ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {p.showOFXPane && (
        <div className="p-4 border-t border-border/60">
          {/* MOBILE */}
          <div className="md:hidden mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Extrato OFX</span>
              <SortSelect value={sortExtrato} onChange={setSortExtrato} />
            </div>
            <div className="space-y-2">
            {extratoOrdenado.map((item) => {
              const match = p.getMatch(item.id);
              const isPareado = !!match;
              const linked = match ? p.lancamentos.find((l) => l.id === match.lancamentoId) : null;
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isPareado ? "border-success/40 bg-success/5" : "border-destructive/30 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
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
                  <div className="flex gap-2">
                    {isPareado ? (
                      <Button size="sm" variant="outline" className="flex-1 h-11"
                        onClick={() => p.onManualMatch(item.id, "")}>
                        Desvincular
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="flex-1 h-11 gap-2"
                          onClick={() => p.onAbrirVincular(item.id)}>
                          <Search className="w-4 h-4" /> Vincular
                        </Button>
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
                  Extrato OFX ({p.extratoItems.length} transações)
                </h3>
                <SortSelect value={sortExtrato} onChange={setSortExtrato} />
              </div>
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {extratoOrdenado.map((item) => {
                  const match = p.getMatch(item.id);
                  const isPareado = !!match;
                  return (
                    <div key={item.id} className={`rounded-lg border p-3 transition-colors ${
                      isPareado ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.descricao || "Sem descrição"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-mono font-semibold ${item.valor >= 0 ? "text-success" : "text-destructive"}`}>
                            {formatCurrency(item.valor)}
                          </span>
                          {isPareado ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <Select value={match?.lancamentoId || "__none__"} onValueChange={(val) => p.onManualMatch(item.id, val === "__none__" ? "" : val)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Vincular lançamento..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhum</SelectItem>
                            {p.lancamentos
                              .filter((l) => !p.usedLancamentoIds.has(l.id) || l.id === match?.lancamentoId)
                              .map((l) => (
                                <SelectItem key={l.id} value={l.id}>
                                  {formatDate(l.data_vencimento)} · {l.descricao} · {formatCurrency(l.valor)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                    return (
                      <div key={l.id} className={`rounded-lg border p-3 transition-colors ${
                        isPareado ? "border-success/40 bg-success/5" : "border-border bg-card"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{l.descricao}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(l.data_vencimento)}</p>
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