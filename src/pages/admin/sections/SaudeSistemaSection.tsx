/**
 * SaudeSistemaSection — painel "Saúde do sistema".
 *
 * Mostra status operacional das integrações administradas (e-mail, auditoria,
 * permissões) e atividade por módulo nas últimas 24h / 7d. Consome
 * `useSaudeSistema` (que lê `v_admin_audit_unified`, `email_send_log` e
 * `email_send_state`) e renderiza com `<HealthBadge>` para garantir
 * consistência visual com outros indicadores de integração.
 */

import { Activity, AlertCircle, FileSignature, Inbox, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HealthBadge } from "@/components/HealthBadge";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import { useSaudeSistema } from "@/pages/admin/hooks/useSaudeSistema";

const ICONES_INTEGRACAO = {
  email: Mail,
  fila_email: Inbox,
  sefaz: FileSignature,
  auditoria: ShieldCheck,
  permissoes: Activity,
} as const;

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function formatAge(seconds: number): string {
  if (seconds <= 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${Math.round(seconds / 3600)}h`;
}

export function SaudeSistemaSection() {
  const { data, isLoading, isFetching, refetch, error } = useSaudeSistema();

  return (
    <SectionShell
      title="Saúde do sistema"
      description="Status operacional das integrações administradas e atividade recente por módulo."
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {data
            ? `Atualizado às ${formatTimestamp(data.geradoEm)}`
            : "Carregando indicadores…"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
          aria-label="Atualizar painel de saúde"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-2 pt-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Não foi possível carregar os indicadores: {(error as Error).message}</span>
          </CardContent>
        </Card>
      )}

      {/* Cartões de integrações */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))
          : data?.integracoes.map((it) => {
              const Icon = ICONES_INTEGRACAO[it.chave];
              return (
                <Card key={it.chave}>
                  <CardHeader className="pb-2 flex-row items-start gap-2 space-y-0">
                    {Icon && <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm">{it.nome}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <HealthBadge status={it.status} details={it.detalhe} />
                    <p className="text-xs text-muted-foreground">{it.detalhe}</p>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Filas pgmq de e-mail */}
      {data && data.filas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Filas de e-mail (pgmq)</CardTitle>
            <CardDescription>
              Profundidade atual e idade da mensagem mais antiga em cada fila.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Fila</th>
                    <th className="py-2 text-right font-medium">Pendentes</th>
                    <th className="py-2 text-right font-medium">Mais antiga</th>
                  </tr>
                </thead>
                <tbody>
                  {data.filas.map((f) => (
                    <tr key={f.queue_name} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">
                        {f.queue_name}
                        {f.queue_name.endsWith("_dlq") && (
                          <span className="ml-2 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                            DLQ
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums">{f.total_messages}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {formatAge(f.oldest_msg_age_seconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI de e-mail */}
      {data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Envio de e-mails (últimas 24h)</CardTitle>
            <CardDescription>Total enviado, falhas e backoff de envio.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="text-2xl font-semibold tabular-nums">{data.email.enviados24h}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Erros</p>
                <p className="text-2xl font-semibold tabular-nums">{data.email.erros24h}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Taxa de erro</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {(data.email.taxaErro * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            {data.email.backoffAte && new Date(data.email.backoffAte) > new Date() && (
              <p className="mt-3 text-xs text-warning">
                Em backoff até {formatTimestamp(data.email.backoffAte)}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Atividade por módulo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Atividade administrativa por módulo</CardTitle>
          <CardDescription>Eventos registrados em `v_admin_audit_unified`.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-full" />
              ))}
            </div>
          ) : data?.modulos.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Módulo</th>
                    <th className="py-2 text-right font-medium">Últimas 24h</th>
                    <th className="py-2 text-right font-medium">Últimos 7 dias</th>
                  </tr>
                </thead>
                <tbody>
                  {data.modulos.map((m) => (
                    <tr key={m.entidade} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{m.entidade}</td>
                      <td className="py-2 text-right tabular-nums">{m.eventos24h}</td>
                      <td className="py-2 text-right tabular-nums">{m.eventos7d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}