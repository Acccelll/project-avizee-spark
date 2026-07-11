/**
 * Conciliação v2 — Sprint 3
 * UI de revisão de sugestões de matching geradas pela RPC
 * `conciliacao_sugerir_matches`. Suporta gerar sugestões, aprovar
 * e rejeitar em lote. Reutiliza serviços das Sprints 1 e 2.
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

interface ExtratoResumo {
  id: string;
  arquivo_nome: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  total_linhas: number;
  status: string;
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

  return (
    <div className="container mx-auto space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Conciliação v2</h1>

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
            <div className="flex gap-2">
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
                {matches.data?.map((m) => {
                  const disabled = m.status !== "sugerido";
                  return (
                    <TableRow key={m.id} data-state={disabled ? "muted" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selecionados.has(m.id)}
                          disabled={disabled}
                          onCheckedChange={() => toggle(m.id)}
                          aria-label="Selecionar sugestão"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={Number(m.score) >= 85 ? "default" : "secondary"}>
                          {Number(m.score).toFixed(0)}
                        </Badge>
                      </TableCell>
                      <TableCell>{m.match_tipo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.extrato_linha_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.lancamento_id?.slice(0, 8) ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {matches.data && matches.data.length === 0 && (
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