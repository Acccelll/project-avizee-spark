import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, FileDown, RefreshCw, Link2, AlertTriangle, AlertCircle, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RelatorioMigracaoFaturamento } from "@/lib/importacao/produtoMatch";
import { toast } from "sonner";

interface Props {
  loteId: string;
  className?: string;
}

function pct(n: number) {
  return `${(n ?? 0).toFixed(1)}%`;
}

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = headers.join(";");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(";")).join("\n");
  return `${headerLine}\n${body}`;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function RelatorioMigracaoFaturamentoCard({ loteId, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RelatorioMigracaoFaturamento | null>(null);

  const fetchRelatorio = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: r, error } = await (supabase.rpc as any)("relatorio_migracao_faturamento", {
        p_lote_id: loteId,
      });
      if (error) throw error;
      setData(r as RelatorioMigracaoFaturamento);
    } catch (err) {
      toast.error(`Erro ao carregar relatório: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loteId) fetchRelatorio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteId]);

  const exportNaoVinculados = () => {
    if (!data?.amostra_nao_vinculados?.length) return;
    const csv = toCsv(
      data.amostra_nao_vinculados.map((r) => ({ codigo: r.codigo ?? "", descricao: r.descricao ?? "", quantidade: r.qtd })),
      ["codigo", "descricao", "quantidade"],
    );
    downloadCsv(`migracao_nao_vinculados_${loteId.slice(0, 8)}.csv`, csv);
  };

  const exportDescontinuados = () => {
    if (!data?.amostra_descontinuados?.length) return;
    const csv = toCsv(
      data.amostra_descontinuados.map((r) => ({
        produto_id: r.produto_id,
        codigo: r.codigo ?? "",
        descricao: r.descricao ?? "",
        descontinuado_em: r.descontinuado_em ?? "",
      })),
      ["produto_id", "codigo", "descricao", "descontinuado_em"],
    );
    downloadCsv(`migracao_descontinuados_${loteId.slice(0, 8)}.csv`, csv);
  };

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          Relatório de Migração — Faturamento
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchRelatorio} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando relatório…
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-md border bg-card">
                <div className="text-xs text-muted-foreground">Total de itens</div>
                <div className="text-2xl font-bold">{data.total_itens}</div>
              </div>
              <div className="p-3 rounded-md border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
                <div className="text-xs text-emerald-700 dark:text-emerald-400">Vinculados</div>
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {data.vinculados}
                </div>
                <div className="text-xs text-emerald-700/70 dark:text-emerald-400/70">{pct(data.pct_vinculados)}</div>
              </div>
              <div className="p-3 rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-200">
                <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Duvidosos
                </div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{data.duvidosos}</div>
                <div className="text-xs text-amber-700/70 dark:text-amber-400/70">{pct(data.pct_duvidosos)}</div>
              </div>
              <div className="p-3 rounded-md border bg-red-50 dark:bg-red-950/20 border-red-200">
                <div className="text-xs text-red-700 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Não vinculados
                </div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-400">{data.nao_vinculados}</div>
                <div className="text-xs text-red-700/70 dark:text-red-400/70">{pct(data.pct_nao_vinculados)}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <PackageX className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Produtos descontinuados criados:</span>
              <span className="font-semibold">{data.produtos_descontinuados_criados}</span>
            </div>

            {data.amostra_nao_vinculados?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Top itens não vinculados</h4>
                  <Button variant="ghost" size="sm" onClick={exportNaoVinculados} className="gap-1">
                    <FileDown className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
                <div className="border rounded-md max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-20 text-right">Qtd</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.amostra_nao_vinculados.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.descricao ?? "—"}</TableCell>
                          <TableCell className="text-right text-xs">{r.qtd}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {data.amostra_descontinuados?.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Produtos criados como descontinuados</h4>
                  <Button variant="ghost" size="sm" onClick={exportDescontinuados} className="gap-1">
                    <FileDown className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
                <div className="border rounded-md max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-32">Descontinuado em</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.amostra_descontinuados.map((r) => (
                        <TableRow key={r.produto_id}>
                          <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.descricao ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.descontinuado_em ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}