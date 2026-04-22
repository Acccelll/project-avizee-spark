/**
 * DashboardAdmin — widgets de monitoramento de segurança.
 *
 * Métricas exibidas (semanticamente confiáveis — vide docs/administracao-modelo.md):
 *  - Sessões ativas       (auth.users.last_sign_in_at nos últimos 30 min)
 *  - Usuários inativos +30d (auth.users.last_sign_in_at < hoje-30d)
 *  - Administradores      (user_roles WHERE role='admin')
 *  - Eventos administrativos 24h (permission_audit nas últimas 24 h)
 *
 * Cards removidos: "Logins Falhos 24h" e "Logins Antigos +30d" — dependiam de
 * eventos `auth:login`/`LOGIN_FAILED` que ninguém grava. Voltarão quando captura
 * via Auth Hooks for implementada.
 */

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, History, ShieldAlert, UserMinus, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSessoesMetricas } from "@/pages/admin/hooks/useSessoesMetricas";
import { useEventosAdminTimeline } from "@/pages/admin/hooks/useEventosAdminTimeline";

async function fetchUsuariosAdministrativos(): Promise<number> {
  const { count, error } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw error;
  return count ?? 0;
}

async function fetchEventosAdmin24h(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("permission_audit")
    .select("*", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export function DashboardAdmin() {
  const sessoes = useSessoesMetricas();
  const timeline = useEventosAdminTimeline();

  const usuariosAdmin = useQuery({
    queryKey: ["admin", "security", "usuarios-admin"],
    queryFn: fetchUsuariosAdministrativos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const eventos24h = useQuery({
    queryKey: ["admin", "security", "eventos-admin-24h"],
    queryFn: fetchEventosAdmin24h,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const ativasCount = sessoes.data?.ativas ?? 0;
  const inativasCount = sessoes.data?.inativasMais30d ?? 0;
  const adminsCount = usuariosAdmin.data ?? 0;
  const eventosCount = eventos24h.data ?? 0;
  const buckets = timeline.data?.buckets ?? [];
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
  const ultimoPorEntidade = timeline.data?.ultimoPorEntidade ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Monitoramento de Segurança
          </CardTitle>
          <CardDescription>
            Indicadores operacionais de acesso e governança, baseados apenas nos dados efetivamente disponíveis hoje.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Sessões ativas"
              value={ativasCount}
              subtitle="Login nos últimos 30 minutos"
              icon={Activity}
              variant="info"
              variationType="neutral"
              loading={sessoes.isLoading}
            />

            <SummaryCard
              title="Inativos (+30 dias)"
              value={inativasCount}
              subtitle="Sem login há mais de 30 dias"
              icon={UserMinus}
              variant={inativasCount > 0 ? "warning" : "success"}
              variationType={inativasCount > 0 ? "negative" : "neutral"}
              loading={sessoes.isLoading}
            />

            <SummaryCard
              title="Administradores"
              value={adminsCount}
              subtitle="Com papel admin atribuído"
              icon={Users}
              variant={adminsCount > 3 ? "warning" : "info"}
              variationType="neutral"
              loading={usuariosAdmin.isLoading}
            />

            <SummaryCard
              title="Eventos admin (24 h)"
              value={eventosCount}
              subtitle="Mudanças em usuários, papéis e permissões"
              icon={ShieldAlert}
              variant={eventosCount > 20 ? "warning" : "info"}
              variationType="neutral"
              loading={eventos24h.isLoading}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/administracao?tab=usuarios">
                Revisar usuários e permissões
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-2">
              <Link to="/auditoria">
                Abrir auditoria administrativa
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Eventos administrativos — últimos 7 dias
            </CardTitle>
            <CardDescription>
              {timeline.isLoading
                ? "Carregando…"
                : `${timeline.data?.total7d ?? 0} eventos no período. Cada barra é um dia.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-24 items-end gap-1.5">
              {buckets.map((b) => {
                const heightPct = (b.total / maxBucket) * 100;
                return (
                  <div key={b.dia} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-primary/70 transition-all"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                      title={`${b.dia}: ${b.total} eventos`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Último evento por entidade
            </CardTitle>
            <CardDescription>
              Última alteração administrativa registrada por escopo de governança.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ultimoPorEntidade.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                {timeline.isLoading ? "Carregando…" : "Nenhum evento nos últimos 7 dias."}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {ultimoPorEntidade.map((e) => (
                  <li
                    key={`${e.entidade}-${e.created_at}`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.entidade}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.tipo_acao ?? "ação não especificada"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
