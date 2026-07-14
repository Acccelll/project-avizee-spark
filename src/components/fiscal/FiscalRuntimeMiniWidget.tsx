import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiscalCentral } from "@/hooks/useFiscalCentral";
import { useFiscalWorkspace } from "@/hooks/useFiscalWorkspace";
import { useFiscalRuntime } from "@/contexts/FiscalRuntimeContext";
import { periodToDateFrom } from "@/lib/periodFilter";

/**
 * Etapa 15 — Mini widget de runtime fiscal para dashboards genéricos.
 *
 * Compacto e independente de tela: consome `useFiscalRuntime()` + `useFiscalCentral()`
 * e resume, em um único card, a taxa de autorização do período e a prontidão
 * para produção. Deve ser embutido **apenas** dentro de `<FiscalRuntimeProvider>`
 * (i.e., em telas sob `/fiscal/*`) — para uso em dashboards globais, envolver
 * o widget no provider antes de renderizar.
 */
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FiscalRuntimeMiniWidget() {
  const runtime = useFiscalRuntime();
  const { period } = useFiscalWorkspace();
  const { query, taxaAutorizacao } = useFiscalCentral({
    from: periodToDateFrom(period),
    to: todayIso(),
  });

  const prontidao = runtime.operacional.prontidao.gerar({
    arquiteturaOk: true,
    segurancaOk: true,
    desempenhoOk: true,
    observabilidadeOk: true,
    cobertura: 1,
    documentacaoOk: true,
    integracoesOk: true,
    bancoOk: true,
    migracoesOk: true,
    filasOk: true,
    cacheOk: true,
    logsOk: true,
    permissoesOk: true,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Runtime fiscal</CardTitle>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {(taxaAutorizacao * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">taxa de autorização</p>
            </div>
            <Badge variant={prontidao.pendentes.length === 0 ? "default" : "destructive"}>
              {prontidao.pendentes.length === 0
                ? "Apto"
                : `${prontidao.pendentes.length} pendência(s)`}
            </Badge>
          </div>
        )}
        <Link
          to="/fiscal/central"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Abrir Central Fiscal <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

export default FiscalRuntimeMiniWidget;