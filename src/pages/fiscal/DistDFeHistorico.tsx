import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sincronizarDistDFe } from "@/services/fiscal/sefaz";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, PlayCircle, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAppConfig } from "@/hooks/useAppConfig";
import {
  aplicarCienciaEmLote,
  buscarNfeSemManifestacao,
} from "@/services/fiscal/autoCiencia.service";

/**
 * Histórico de execuções do cron `process-distdfe-cron`.
 *
 * Lê `auditoria_logs` filtrado por `acao='distdfe_cron_run'` (gravado pela
 * edge function ao final de cada execução), exibindo KPIs por execução e
 * detalhes por CNPJ, com botão de re-execução manual.
 */

interface ExecucaoDetalhe {
  cnpj: string;
  sucesso: boolean;
  novos: number;
  duplicados: number;
  cStat?: string;
  xMotivo?: string;
  erro?: string;
}

interface ExecucaoLog {
  id: string;
  created_at: string;
  dados_novos: {
    ambiente?: "1" | "2";
    inicio?: string;
    fim?: string;
    total_cnpjs?: number;
    total_novos?: number;
    total_duplicados?: number;
    total_erros?: number;
    detalhes?: ExecucaoDetalhe[];
  } | null;
}

export default function DistDFeHistorico() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ExecucaoLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const {
    value: autoCiencia,
    save: saveAutoCiencia,
    loading: loadingFlag,
  } = useAppConfig<boolean>("distdfe_auto_ciencia", false);
  const [aplicandoLote, setAplicandoLote] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auditoria_logs")
      .select("id, created_at, dados_novos")
      .eq("acao", "distdfe_cron_run")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as unknown as ExecucaoLog[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { void carregar(); }, [carregar]);

  const executarAgora = async (ambiente: "1" | "2") => {
    setRunning(true);
    try {
      const r = await sincronizarDistDFe(ambiente);
      if (r.sucesso) {
        toast({
          title: "Sincronização concluída",
          description: `${r.novos} nova(s), ${r.duplicados} existente(s).`,
        });
      } else {
        toast({
          title: "Falha na sincronização",
          description: r.erro ?? r.xMotivo ?? "Erro desconhecido",
          variant: "destructive",
        });
      }
    } finally {
      setRunning(false);
      void carregar();
    }
  };

  const ultima = rows[0];
  const kpis = useMemo(() => {
    const ultimas10 = rows.slice(0, 10);
    return {
      execucoes: rows.length,
      novos10: ultimas10.reduce((s, r) => s + (r.dados_novos?.total_novos ?? 0), 0),
      erros10: ultimas10.reduce((s, r) => s + (r.dados_novos?.total_erros ?? 0), 0),
    };
  }, [rows]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/faturamento" aria-label="Voltar"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Histórico DistDF-e</h1>
            <p className="text-sm text-muted-foreground">
              Execuções do cron diário de sincronização de NF-e de entrada (SEFAZ Ambiente Nacional)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => void executarAgora("2")} disabled={running}>
            <PlayCircle className="h-4 w-4 mr-2" />
            {running ? "Executando..." : "Executar agora (Hom.)"}
          </Button>
          <Button variant="secondary" onClick={() => void executarAgora("1")} disabled={running}>
            <PlayCircle className="h-4 w-4 mr-2" />
            Produção
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Execuções (últimas 50)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{kpis.execucoes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">NF-e novas (últimas 10)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{kpis.novos10}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Erros (últimas 10)</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${kpis.erros10 > 0 ? "text-destructive" : ""}`}>{kpis.erros10}</div>
          </CardContent>
        </Card>
      </div>

      {ultima && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Última execução</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div>Quando: <strong>{format(new Date(ultima.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</strong></div>
            <div>Ambiente: <Badge variant={ultima.dados_novos?.ambiente === "1" ? "default" : "secondary"}>{ultima.dados_novos?.ambiente === "1" ? "Produção" : "Homologação"}</Badge></div>
            <div>CNPJs processados: {ultima.dados_novos?.total_cnpjs ?? 0} · Novos: <strong>{ultima.dados_novos?.total_novos ?? 0}</strong> · Duplicados: {ultima.dados_novos?.total_duplicados ?? 0} · Erros: <span className={(ultima.dados_novos?.total_erros ?? 0) > 0 ? "text-destructive font-semibold" : ""}>{ultima.dados_novos?.total_erros ?? 0}</span></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Execuções recentes</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma execução registrada ainda. O cron roda diariamente às 06:00 UTC.
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {rows.map((r) => {
                const d = r.dados_novos ?? {};
                const isOpen = expanded === r.id;
                const erros = d.total_erros ?? 0;
                return (
                  <div key={r.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                      className="w-full px-4 py-3 hover:bg-muted/50 text-left flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium">
                          {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </span>
                        <Badge variant={d.ambiente === "1" ? "default" : "secondary"}>{d.ambiente === "1" ? "Prod" : "Hom"}</Badge>
                        <span className="text-xs text-muted-foreground">{d.total_cnpjs ?? 0} CNPJ(s)</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span>Novos: <strong className="text-foreground">{d.total_novos ?? 0}</strong></span>
                        <span className="text-muted-foreground">Dup: {d.total_duplicados ?? 0}</span>
                        <span className={erros > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>Erros: {erros}</span>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 bg-muted/30">
                        {(d.detalhes ?? []).length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2">Sem detalhes por CNPJ.</div>
                        ) : (
                          <table className="w-full text-xs mt-2">
                            <thead className="text-muted-foreground">
                              <tr className="text-left">
                                <th className="py-1">CNPJ</th>
                                <th className="py-1">Status</th>
                                <th className="py-1 text-right">Novos</th>
                                <th className="py-1 text-right">Dup.</th>
                                <th className="py-1">cStat</th>
                                <th className="py-1">Mensagem</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(d.detalhes ?? []).map((det, idx) => (
                                <tr key={`${r.id}-${idx}`}>
                                  <td className="py-1 font-mono">{det.cnpj}</td>
                                  <td className="py-1">
                                    <Badge variant={det.sucesso ? "outline" : "destructive"}>
                                      {det.sucesso ? "OK" : "Falha"}
                                    </Badge>
                                  </td>
                                  <td className="py-1 text-right">{det.novos}</td>
                                  <td className="py-1 text-right">{det.duplicados}</td>
                                  <td className="py-1">{det.cStat ?? "—"}</td>
                                  <td className="py-1 text-muted-foreground">{det.xMotivo ?? det.erro ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
