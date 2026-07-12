import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Link2, Undo2, EyeOff, Plus, Wand2, Sparkles, EyeOff as EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import {
  listLinhasDaFatura,
  listLancamentosCandidatosDaFatura,
  vincularLinha,
  vincularLinhasEmLote,
  desvincularLinha,
  setLinhaStatus,
  criarLancamentoDaLinha,
  type FaturaLinha,
  type CandidatoLancamento,
} from "@/services/conciliacaoCartao/faturaLinhas.service";

function diasEntre(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export interface ReconciliacaoFaturaPanelProps {
  faturaId: string;
  cartaoId: string;
  competencia: string;
  cartaoNome: string;
  dataFechamento: string | null;
  dataVencimento: string | null;
  onBack: () => void;
}

export function ReconciliacaoFaturaPanel({
  faturaId,
  cartaoId,
  competencia,
  cartaoNome,
  dataFechamento,
  dataVencimento,
  onBack,
}: ReconciliacaoFaturaPanelProps) {
  const qc = useQueryClient();
  const [selLinhas, setSelLinhas] = useState<Set<string>>(new Set());
  const [selLanc, setSelLanc] = useState<Set<string>>(new Set());
  const [buscaLinha, setBuscaLinha] = useState("");
  const [buscaLanc, setBuscaLanc] = useState("");
  const [busy, setBusy] = useState(false);
  type SortKey = "data-asc" | "data-desc" | "valor-asc" | "valor-desc";
  const [ordLinha, setOrdLinha] = useState<SortKey>("data-asc");
  const [ordLanc, setOrdLanc] = useState<SortKey>("data-asc");

  const empresa = useQuery({
    queryKey: ["empresa", "atual"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const linhas = useQuery({
    queryKey: ["cartao-faturas", "linhas", faturaId],
    queryFn: () => listLinhasDaFatura(faturaId),
  });

  const candidatos = useQuery({
    queryKey: ["cartao-faturas", "candidatos-erp", faturaId, empresa.data],
    enabled: !!empresa.data,
    queryFn: () =>
      listLancamentosCandidatosDaFatura({
        empresa_id: empresa.data as string,
        cartao_id: cartaoId,
        data_fechamento: dataFechamento,
        data_vencimento: dataVencimento,
      }),
  });

  const linhasFiltradas = useMemo(() => {
    const all = linhas.data ?? [];
    const t = buscaLinha.trim().toLowerCase();
    const filtrado = all.filter((l) => (t ? (l.descricao ?? "").toLowerCase().includes(t) : true));
    const sorted = [...filtrado].sort((a, b) => {
      if (ordLinha === "data-asc") return (a.data_compra ?? "").localeCompare(b.data_compra ?? "");
      if (ordLinha === "data-desc") return (b.data_compra ?? "").localeCompare(a.data_compra ?? "");
      const va = Math.abs(Number(a.valor || 0));
      const vb = Math.abs(Number(b.valor || 0));
      return ordLinha === "valor-asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [linhas.data, buscaLinha, ordLinha]);

  const candidatosFiltrados = useMemo(() => {
    const all = candidatos.data ?? [];
    const t = buscaLanc.trim().toLowerCase();
    const filtrado = all.filter((l) => (t ? (l.descricao ?? "").toLowerCase().includes(t) : true));
    const sorted = [...filtrado].sort((a, b) => {
      if (ordLanc === "data-asc") return (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? "");
      if (ordLanc === "data-desc") return (b.data_vencimento ?? "").localeCompare(a.data_vencimento ?? "");
      const va = Number(a.valor || 0);
      const vb = Number(b.valor || 0);
      return ordLanc === "valor-asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [candidatos.data, buscaLanc, ordLanc]);

  const somaLinhas = useMemo(
    () => (linhas.data ?? [])
      .filter((l) => selLinhas.has(l.id))
      .reduce((s, l) => s + Math.abs(Number(l.valor || 0)), 0),
    [linhas.data, selLinhas],
  );
  const somaLanc = useMemo(
    () => (candidatos.data ?? [])
      .filter((l) => selLanc.has(l.id))
      .reduce((s, l) => s + Number(l.valor || 0), 0),
    [candidatos.data, selLanc],
  );
  const diff = Math.round((somaLinhas - somaLanc) * 100) / 100;

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["cartao-faturas", "linhas", faturaId] });
    qc.invalidateQueries({ queryKey: ["cartao-faturas", "candidatos-erp", faturaId] });
    qc.invalidateQueries({ queryKey: ["cartao-faturas", "lancamentos", faturaId] });
  };

  const toggle = (setter: typeof setSelLinhas) => (id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const conciliar = async () => {
    const ln = Array.from(selLinhas);
    const lc = Array.from(selLanc);
    if (ln.length === 0 || lc.length === 0) {
      toast.error("Selecione pelo menos uma linha e um lançamento");
      return;
    }
    setBusy(true);
    try {
      if (lc.length === 1) {
        await vincularLinhasEmLote(ln, lc[0]);
      } else if (ln.length === lc.length) {
        // pareamento 1:1 na ordem selecionada
        for (let i = 0; i < ln.length; i++) {
          await vincularLinha(ln[i], lc[i]);
        }
      } else {
        toast.error("Para pareamento múltiplo, selecione a mesma quantidade dos dois lados (ou 1 único lançamento).");
        setBusy(false);
        return;
      }
      toast.success(`${ln.length} linha(s) conciliada(s)`);
      setSelLinhas(new Set());
      setSelLanc(new Set());
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao conciliar");
    } finally {
      setBusy(false);
    }
  };

  const acaoDesvincular = async (id: string) => {
    setBusy(true);
    try {
      await desvincularLinha(id);
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao desvincular");
    } finally { setBusy(false); }
  };

  const acaoIgnorar = async (id: string) => {
    setBusy(true);
    try {
      await setLinhaStatus(id, "ignorada");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ignorar");
    } finally { setBusy(false); }
  };

  const acaoCriarLancDaLinha = async (linha: FaturaLinha) => {
    if (!empresa.data) return;
    setBusy(true);
    try {
      await criarLancamentoDaLinha({
        empresa_id: empresa.data,
        linha_id: linha.id,
        cartao_id: cartaoId,
        descricao: linha.descricao ?? "(sem descrição)",
        valor: Number(linha.valor || 0),
        data_vencimento: linha.data_compra,
      });
      toast.success("Lançamento criado e vinculado");
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar lançamento");
    } finally { setBusy(false); }
  };

  /** Auto-concilia linhas pendentes com match ÚNICO por valor exato (janela ±7d). */
  const acaoAutoConciliar = async () => {
    const linhasPend = (linhas.data ?? []).filter((l) => (l.status ?? "pendente") === "pendente");
    const cands = candidatos.data ?? [];
    if (!linhasPend.length || !cands.length) {
      toast.info("Nada para auto-conciliar");
      return;
    }
    const usados = new Set<string>();
    const pares: Array<{ linhaId: string; lancId: string }> = [];
    for (const li of linhasPend) {
      const valor = Math.abs(Number(li.valor || 0));
      const compat = cands.filter(
        (c) =>
          !usados.has(c.id) &&
          Math.abs(Number(c.valor) - valor) < 0.01 &&
          diasEntre(c.data_vencimento, li.data_compra) <= 7,
      );
      if (compat.length === 1) {
        pares.push({ linhaId: li.id, lancId: compat[0].id });
        usados.add(compat[0].id);
      }
    }
    if (!pares.length) {
      toast.info("Nenhum match único encontrado (valor exato ±7d)");
      return;
    }
    setBusy(true);
    try {
      for (const p of pares) await vincularLinha(p.linhaId, p.lancId);
      toast.success(`${pares.length} linha(s) auto-conciliada(s)`);
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na auto-conciliação");
    } finally { setBusy(false); }
  };

  /** Cria lançamentos para todas as linhas pendentes de uma vez. */
  const acaoCriarPendentes = async () => {
    if (!empresa.data) return;
    const pend = (linhas.data ?? []).filter((l) => (l.status ?? "pendente") === "pendente");
    if (!pend.length) { toast.info("Sem linhas pendentes"); return; }
    setBusy(true);
    let ok = 0;
    try {
      for (const li of pend) {
        await criarLancamentoDaLinha({
          empresa_id: empresa.data,
          linha_id: li.id,
          cartao_id: cartaoId,
          descricao: li.descricao ?? "(sem descrição)",
          valor: Number(li.valor || 0),
          data_vencimento: li.data_compra,
        });
        ok++;
      }
      toast.success(`${ok} lançamento(s) criado(s)`);
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Falha após criar ${ok}`);
      invalidateAll();
    } finally { setBusy(false); }
  };

  /** Marca todas as linhas pendentes como ignoradas. */
  const acaoIgnorarPendentes = async () => {
    const pend = (linhas.data ?? []).filter((l) => (l.status ?? "pendente") === "pendente");
    if (!pend.length) { toast.info("Sem linhas pendentes"); return; }
    setBusy(true);
    try {
      for (const li of pend) await setLinhaStatus(li.id, "ignorada");
      toast.success(`${pend.length} linha(s) ignorada(s)`);
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao ignorar");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />Voltar para faturas
          </Button>
          <div>
            <p className="text-sm font-medium">
              {cartaoNome} · Fatura {competencia}
            </p>
            <p className="text-xs text-muted-foreground">
              Fechamento {fmtDate(dataFechamento)} · Vencimento {fmtDate(dataVencimento)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Linhas: <strong>{fmt(somaLinhas)}</strong></span>
          <span>ERP: <strong>{fmt(somaLanc)}</strong></span>
          <span className={diff === 0 ? "text-emerald-600" : "text-amber-600"}>
            Diferença: <strong>{fmt(diff)}</strong>
          </span>
          <Button size="sm" variant="outline" onClick={acaoAutoConciliar} disabled={busy} title="Match único por valor exato ±7 dias">
            <Wand2 className="mr-1 h-4 w-4" />Auto-conciliar
          </Button>
          <Button size="sm" variant="outline" onClick={acaoCriarPendentes} disabled={busy} title="Cria lançamentos a pagar para todas as linhas pendentes">
            <Sparkles className="mr-1 h-4 w-4" />Criar pendentes
          </Button>
          <Button size="sm" variant="ghost" onClick={acaoIgnorarPendentes} disabled={busy} title="Marca todas as linhas pendentes como ignoradas">
            <EyeOffIcon className="mr-1 h-4 w-4" />Ignorar pendentes
          </Button>
          <Button size="sm" onClick={conciliar} disabled={busy || selLinhas.size === 0 || selLanc.size === 0}>
            <Link2 className="mr-1 h-4 w-4" />Conciliar selecionados
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Coluna esquerda: linhas da fatura */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Linhas da fatura ({linhasFiltradas.length})
              </CardTitle>
              <Select value={ordLinha} onValueChange={(v) => setOrdLinha(v as SortKey)}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data-asc">Data ↑</SelectItem>
                  <SelectItem value="data-desc">Data ↓</SelectItem>
                  <SelectItem value="valor-asc">Valor ↑</SelectItem>
                  <SelectItem value="valor-desc">Valor ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Buscar linha…"
              value={buscaLinha}
              onChange={(e) => setBuscaLinha(e.target.value)}
              className="mt-2 h-8 text-xs"
            />
          </CardHeader>
          <CardContent>
            {linhas.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : linhasFiltradas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma linha nesta fatura.</p>
            ) : (
              <div className="max-h-[560px] space-y-1 overflow-auto pr-1">
                {linhasFiltradas.map((li) => {
                  const st = (li.status ?? "pendente") as string;
                  const vinculada = st === "vinculada" || st === "criada";
                  const ignorada = st === "ignorada";
                  const checked = selLinhas.has(li.id);
                  return (
                    <div
                      key={li.id}
                      className={`flex items-start gap-2 rounded border p-2 text-xs ${ignorada ? "opacity-60" : ""} ${checked ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        disabled={vinculada || ignorada}
                        onCheckedChange={() => toggle(setSelLinhas)(li.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{li.descricao ?? "(sem descrição)"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtDate(li.data_compra)}
                          {li.parcela_atual && li.parcela_total ? ` · ${li.parcela_atual}/${li.parcela_total}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-medium">{fmt(Number(li.valor || 0))}</span>
                        <StatusBadge status={st} />
                        <div className="flex gap-0.5">
                          {vinculada ? (
                            <Button size="sm" variant="ghost" className="h-6 px-1" title="Desvincular" disabled={busy} onClick={() => acaoDesvincular(li.id)}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : ignorada ? (
                            <Button size="sm" variant="ghost" className="h-6 px-1" title="Reabrir" disabled={busy} onClick={() => setLinhaStatus(li.id, "pendente").then(invalidateAll)}>
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 px-1" title="Criar lançamento a pagar" disabled={busy} onClick={() => acaoCriarLancDaLinha(li)}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-1" title="Ignorar" disabled={busy} onClick={() => acaoIgnorar(li.id)}>
                                <EyeOff className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Coluna direita: lançamentos ERP */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">
                Lançamentos ERP a pagar ({candidatosFiltrados.length})
              </CardTitle>
              <Select value={ordLanc} onValueChange={(v) => setOrdLanc(v as SortKey)}>
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="data-asc">Data ↑</SelectItem>
                  <SelectItem value="data-desc">Data ↓</SelectItem>
                  <SelectItem value="valor-asc">Valor ↑</SelectItem>
                  <SelectItem value="valor-desc">Valor ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              placeholder="Buscar lançamento…"
              value={buscaLanc}
              onChange={(e) => setBuscaLanc(e.target.value)}
              className="mt-2 h-8 text-xs"
            />
          </CardHeader>
          <CardContent>
            {candidatos.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : candidatosFiltrados.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento ERP em aberto compatível com a janela desta fatura.
              </p>
            ) : (
              <div className="max-h-[560px] space-y-1 overflow-auto pr-1">
                {candidatosFiltrados.map((l: CandidatoLancamento) => {
                  const checked = selLanc.has(l.id);
                  return (
                    <div
                      key={l.id}
                      className={`flex items-start gap-2 rounded border p-2 text-xs ${checked ? "border-primary bg-primary/5" : ""}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={checked}
                        onCheckedChange={() => toggle(setSelLanc)(l.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{l.descricao ?? "(sem descrição)"}</p>
                        <p className="text-[11px] text-muted-foreground">Venc. {fmtDate(l.data_vencimento)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-medium">{fmt(Number(l.valor || 0))}</span>
                        <StatusBadge status={l.status ?? "aberto"} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}