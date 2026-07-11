/**
 * Conciliação v2 — UI de revisão de sugestões de matching.
 * Suporta sugestões 1:1 e agrupadas, além de aprovação/rejeição
 * transacional por operação.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConciliacaoMatches } from "@/hooks/useConciliacaoMatches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { ConciliacaoMatch } from "@/types/domain";
import { ImportarExtratoDialog } from "./conciliacao/ImportarExtratoDialog";
import { Link } from "react-router-dom";

interface ExtratoResumo {
  id: string;
  arquivo_nome: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_linhas: number;
  status: string;
}

interface MatchGroup {
  operationId: string;
  representative: ConciliacaoMatch;
  ids: string[];
  linhasCount: number;
  lancamentosCount: number;
  score: number;
}

export default function ConciliacaoV2Page() {
  const [extratoId, setExtratoId] = useState<string | undefined>();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const extratosQuery = useQuery({
    queryKey: ["conciliacao", "extratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conciliacao_extratos")
        .select("id, arquivo_nome, periodo_inicio, periodo_fim, total_linhas, status")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as ExtratoResumo[];
    },
  });

  const matches = useConciliacaoMatches(extratoId);

  const idsSelecionados = useMemo(() => Array.from(selecionados), [selecionados]);
  const grupos = useMemo<MatchGroup[]>(() => {
    const map = new Map<string, ConciliacaoMatch[]>();
    for (const match of matches.data ?? []) {
      const key = match.operation_id ?? match.id;
      map.set(key, [...(map.get(key) ?? []), match]);
    }

    return Array.from(map.entries()).map(([operationId, rows]) => {
      const representative = rows[0];
      return {
        operationId,
        representative,
        ids: rows.map((row) => row.id),
        linhasCount: new Set(rows.map((row) => row.extrato_linha_id)).size,
        lancamentosCount: new Set(rows.map((row) => row.lancamento_id)).size,
        score: Math.max(...rows.map((row) => Number(row.score ?? 0))),
      };
    });
  }, [matches.data]);

  const toggle = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSugerir = async () => {
    try {
      const res = await matches.sugerir.mutateAsync();
      toast.success(`${res.sugestoes_criadas} sugestões geradas`);
    } catch (err) {
      logger.error("conciliacao.v2.sugerir", { err });
      toast.error("Falha ao gerar sugestões");
    }
  };

  const handleSugerirAgrupados = async () => {
    try {
      const res = await matches.sugerirAgrupados.mutateAsync();
      toast.success(`${res.sugestoes_criadas} sugestões agrupadas geradas`);
    } catch (err) {
      logger.error("conciliacao.v2.sugerir_agrupados", { err });
      toast.error("Falha ao gerar sugestões agrupadas");
    }
  };

  const handleDecidir = async (decisao: "aprovar" | "rejeitar") => {
    if (idsSelecionados.length === 0) {
      toast.info("Selecione ao menos uma sugestão");
      return;
    }
    try {
      const res = await matches.decidir.mutateAsync({
        ids: idsSelecionados,
        decisao,
      });
      toast.success(
        `${res.ok} ${decisao === "aprovar" ? "aprovadas" : "rejeitadas"}` +
          (res.falhas.length ? ` · ${res.falhas.length} falharam` : ""),
      );
      setSelecionados(new Set());
    } catch (err) {
      logger.error("conciliacao.v2.decidir", { err });
      toast.error("Falha ao registrar decisão");
    }
  };

  const handleAutoAprovar = async () => {
    try {
      const res = await matches.autoAprovar.mutateAsync();
      toast.success(
        `${res.matches_aprovados} sugestões autoaprovadas · ${res.baixas_aplicadas} baixas aplicadas` +
          (res.falhas ? ` · ${res.falhas} falharam` : ""),
      );
      setSelecionados(new Set());
    } catch (err) {
      logger.error("conciliacao.v2.auto_aprovar", { err });
      toast.error("Falha ao autoaprovar sugestões");
    }
  };

  return (
    <div className="container mx-auto space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Conciliação v2</h1>
        <div className="flex flex-wrap gap-2">
          <ImportarExtratoDialog onImported={() => extratosQuery.refetch()} />
          <Button asChild size="sm" variant="outline">
            <Link to="/financeiro/conciliacao/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extratos importados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {extratosQuery.isLoading && <span>Carregando…</span>}
          {extratosQuery.data?.map((e) => (
            <Button
              key={e.id}
              size="sm"
              variant={extratoId === e.id ? "default" : "outline"}
              onClick={() => {
                setExtratoId(e.id);
                setSelecionados(new Set());
              }}
            >
              {e.arquivo_nome}{" "}
              <Badge variant="secondary" className="ml-2">
                {e.total_linhas}
              </Badge>
            </Button>
          ))}
          {extratosQuery.data && extratosQuery.data.length === 0 && (
            <span className="text-sm text-muted-foreground">
              Nenhum extrato importado.
            </span>
          )}
        </CardContent>
      </Card>

      {extratoId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Sugestões de matching</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSugerir}
                disabled={matches.sugerir.isPending}
              >
                {matches.sugerir.isPending ? "Gerando…" : "Gerar sugestões"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSugerirAgrupados}
                disabled={matches.sugerirAgrupados.isPending}
              >
                {matches.sugerirAgrupados.isPending ? "Agrupando…" : "Gerar agrupadas"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleAutoAprovar}
                disabled={matches.autoAprovar.isPending}
              >
                {matches.autoAprovar.isPending ? "Autoaprovando…" : "Auto-aprovar sugestões"}
              </Button>
              <Button
                size="sm"
                onClick={() => handleDecidir("aprovar")}
                disabled={matches.decidir.isPending || idsSelecionados.length === 0}
              >
                Aprovar ({idsSelecionados.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDecidir("rejeitar")}
                disabled={matches.decidir.isPending || idsSelecionados.length === 0}
              >
                Rejeitar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Score</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linha do extrato</TableHead>
                  <TableHead>Lançamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6}>Carregando…</TableCell>
                  </TableRow>
                )}
                {grupos.map((grupo) => {
                  const m = grupo.representative;
                  const disabled = m.status !== "sugerido";
                  return (
                    <TableRow key={grupo.operationId} data-state={disabled ? "muted" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selecionados.has(m.id)}
                          disabled={disabled}
                          onCheckedChange={() => toggle(m.id)}
                          aria-label="Selecionar sugestão"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={grupo.score >= 85 ? "default" : "secondary"}>
                          {grupo.score.toFixed(0)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.match_tipo === "1:1" ? "outline" : "secondary"}>
                          {m.match_tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {grupo.linhasCount > 1
                          ? `${grupo.linhasCount} linhas`
                          : m.extrato_linha_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {grupo.lancamentosCount > 1
                          ? `${grupo.lancamentosCount} lançamentos`
                          : m.lancamento_id?.slice(0, 8) ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {matches.data && grupos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma sugestão. Clique em "Gerar sugestões".
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}