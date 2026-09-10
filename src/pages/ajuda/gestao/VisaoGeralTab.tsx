import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, FolderOpen, Inbox, ListTodo } from "lucide-react";
import { formatDateTime, formatIdade } from "@/lib/format";
import { useEventosRecentes, useFilaChamados } from "@/pages/ajuda/hooks/useSuporteAdmin";
import { EVENTO_LABELS, TIPO_ICON_EMOJI } from "@/pages/ajuda/suporteLabels";
import type { SuporteChamado } from "@/services/suporte.service";

const STATUS_TERMINAIS = ["resolvido", "fechado", "cancelado"] as const;

function ehAtivo(chamado: SuporteChamado): boolean {
  return !(STATUS_TERMINAIS as readonly string[]).includes(chamado.status);
}

function ehHoje(data: string): boolean {
  const d = new Date(data);
  const agora = new Date();
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth() && d.getDate() === agora.getDate();
}

/**
 * Visão geral (spec §20) — responde "o que precisa de atenção agora?".
 * Seis indicadores simples (sem RPC dedicada, agregados no cliente sobre a
 * mesma lista da Fila/Kanban/Histórico) + blocos "Requer atenção" e
 * "Atividade recente".
 */
export function VisaoGeralTab() {
  const { data: chamados, isLoading } = useFilaChamados();
  const { data: eventos, isLoading: isLoadingEventos } = useEventosRecentes();

  const chamadoPorId = useMemo(() => {
    const map = new Map<string, SuporteChamado>();
    (chamados ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [chamados]);

  const stats = useMemo(() => {
    if (!chamados) return null;
    const ativos = chamados.filter(ehAtivo);
    const abertos = ativos.length;
    const novos = chamados.filter((c) => c.status === "aberto").length;
    const emAndamento = chamados.filter((c) => c.status === "em_andamento").length;
    const aguardandoUsuario = chamados.filter((c) => c.status === "aguardando_usuario").length;
    const criticos = ativos.filter((c) => c.prioridade === "critica").length;
    const resolvidosHoje = chamados.filter((c) => c.status === "resolvido" && c.resolved_at && ehHoje(c.resolved_at)).length;

    const requerAtencao = ativos
      .filter((c) => c.prioridade === "critica" || c.prioridade === "alta")
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 8);

    return { abertos, novos, emAndamento, aguardandoUsuario, criticos, resolvidosHoje, requerAtencao };
  }, [chamados]);

  if (isLoading || !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  const indicadores = [
    { label: "Abertos", value: stats.abertos, icon: Inbox, className: "" },
    { label: "Novos", value: stats.novos, icon: ListTodo, className: "" },
    { label: "Em andamento", value: stats.emAndamento, icon: FolderOpen, className: "" },
    { label: "Aguardando usuário", value: stats.aguardandoUsuario, icon: Clock, className: "" },
    { label: "Críticos", value: stats.criticos, icon: AlertTriangle, className: "text-destructive" },
    { label: "Resolvidos hoje", value: stats.resolvidosHoje, icon: CheckCircle2, className: "text-success" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {indicadores.map(({ label, value, icon: Icon, className }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={`h-4 w-4 ${className || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent><p className={`text-2xl font-semibold ${className}`}>{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><p className="text-sm font-semibold">Requer atenção</p></CardHeader>
          <CardContent className="space-y-2">
            {stats.requerAtencao.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum chamado crítico ou de alta prioridade em aberto.</p>
            ) : (
              stats.requerAtencao.map((c) => (
                <Link
                  key={c.id}
                  to={`/ajuda/chamados/${c.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span aria-hidden>{TIPO_ICON_EMOJI[c.tipo]}</span>
                    <span className="truncate">{c.resumo}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatIdade(c.created_at)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><p className="text-sm font-semibold">Atividade recente</p></CardHeader>
          <CardContent className="space-y-2">
            {isLoadingEventos ? (
              <Skeleton className="h-32 rounded-md" />
            ) : !eventos?.length ? (
              <p className="text-sm text-muted-foreground">Nenhuma atividade recente.</p>
            ) : (
              eventos.map((e) => {
                const chamado = chamadoPorId.get(e.chamado_id);
                return (
                  <Link
                    key={e.id}
                    to={`/ajuda/chamados/${e.chamado_id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{EVENTO_LABELS[e.tipo]}</span>
                      {chamado && <span className="ml-1 font-mono text-xs text-muted-foreground">{chamado.numero}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
