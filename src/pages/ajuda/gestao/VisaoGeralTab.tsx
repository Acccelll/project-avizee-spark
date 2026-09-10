import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, Inbox } from "lucide-react";
import { calculateDaysBetween } from "@/lib/format";
import { useFilaChamados } from "@/pages/ajuda/hooks/useSuporteAdmin";
import { STATUS_LABELS, TIPO_LABELS } from "@/pages/ajuda/suporteLabels";

const ATIVOS = ["aberto", "em_triagem", "em_andamento", "aguardando_usuario"] as const;

/** Indicadores simples da fila — sem RPC dedicada, agregado no cliente sobre a mesma lista da Fila/Kanban. */
export function VisaoGeralTab() {
  const { data: chamados, isLoading } = useFilaChamados();

  const stats = useMemo(() => {
    if (!chamados) return null;
    const ativos = chamados.filter((c) => (ATIVOS as readonly string[]).includes(c.status));
    const criticos = ativos.filter((c) => c.prioridade === "critica");
    const resolvidos = chamados.filter((c) => c.status === "resolvido" || c.status === "fechado");
    const maisAntigo = ativos.reduce<number>((max, c) => {
      const dias = calculateDaysBetween(c.created_at, new Date());
      return dias > max ? dias : max;
    }, 0);

    const porTipo = ativos.reduce<Record<string, number>>((acc, c) => {
      acc[c.tipo] = (acc[c.tipo] ?? 0) + 1;
      return acc;
    }, {});

    return { ativos: ativos.length, criticos: criticos.length, resolvidos: resolvidos.length, maisAntigo, porTipo };
  }, [chamados]);

  if (isLoading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs text-muted-foreground">Chamados ativos</p>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.ativos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs text-muted-foreground">Prioridade crítica</p>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold text-destructive">{stats.criticos}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs text-muted-foreground">Mais antigo em aberto</p>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.maisAntigo}d</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-xs text-muted-foreground">Resolvidos/fechados</p>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><p className="text-2xl font-semibold">{stats.resolvidos}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><p className="text-sm font-semibold">Ativos por tipo</p></CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {Object.entries(stats.porTipo).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum chamado ativo no momento.</p>
          ) : (
            Object.entries(stats.porTipo).map(([tipo, count]) => (
              <div key={tipo} className="text-sm">
                <span className="font-semibold">{count}</span>{" "}
                <span className="text-muted-foreground">{TIPO_LABELS[tipo as keyof typeof TIPO_LABELS] ?? tipo}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Status considerados ativos: {ATIVOS.map((s) => STATUS_LABELS[s]).join(", ")}.
      </p>
    </div>
  );
}
