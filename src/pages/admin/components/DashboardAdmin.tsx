/**
 * DashboardAdmin — widgets de monitoramento de segurança para o módulo Admin.
 *
 * Exibe:
 *  - Tentativas de login falhas nas últimas 24 h
 *  - Usuários com permissões administrativas
 *  - Logins antigos (eventos de login registrados há mais de 30 dias)
 *    NOTA: esta métrica conta registros de auditoria_logs com ação "auth:login",
 *    NÃO sessões activas. Uma futura integração com `admin-sessions` permitirá
 *    métricas reais de sessão.
 */

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, ShieldAlert, Users } from "lucide-react";
import { SummaryCard } from "@/components/SummaryCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

// ─── Query functions ──────────────────────────────────────────────────────────

async function fetchLoginsFalhos(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("auditoria_logs")
    .select("*", { count: "exact", head: true })
    .eq("tabela", "auth")
    .eq("acao", "LOGIN_FAILED")
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

async function fetchUsuariosAdministrativos(): Promise<number> {
  const { count, error } = await supabase
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw error;
  return count ?? 0;
}

async function fetchLoginsAntigos(): Promise<number> {
  // Counts audit log entries for login events older than 30 days.
  // This is NOT a real active-session metric — it reflects login events stored
  // in auditoria_logs. Integration with admin-sessions is needed for true session data.
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("auditoria_logs")
      .select("*", { count: "exact", head: true })
      .eq("acao", "auth:login")
      .lt("created_at", cutoff);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function DashboardAdmin() {
  const loginsFalhos = useQuery({
    queryKey: ["admin", "security", "logins-falhos"],
    queryFn: fetchLoginsFalhos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const usuariosAdmin = useQuery({
    queryKey: ["admin", "security", "usuarios-admin"],
    queryFn: fetchUsuariosAdministrativos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const loginsAntigos = useQuery({
    queryKey: ["admin", "security", "logins-antigos"],
    queryFn: fetchLoginsAntigos,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const loginsFalhosCount = loginsFalhos.data ?? 0;
  const usuariosAdminCount = usuariosAdmin.data ?? 0;
  const loginsAntigosCount = loginsAntigos.data ?? 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            Monitoramento de Segurança
          </CardTitle>
          <CardDescription>
            Indicadores de segurança e atividade do sistema em tempo real.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              title="Logins Falhos (24 h)"
              value={loginsFalhosCount}
              subtitle="Tentativas de acesso mal-sucedidas"
              icon={AlertTriangle}
              variant={loginsFalhosCount > 10 ? "danger" : loginsFalhosCount > 0 ? "warning" : "success"}
              variationType={loginsFalhosCount > 0 ? "negative" : "neutral"}
              loading={loginsFalhos.isLoading}
            />

            <SummaryCard
              title="Usuários Administradores"
              value={usuariosAdminCount}
              subtitle="Com permissões de nível admin"
              icon={Users}
              variant={usuariosAdminCount > 3 ? "warning" : "info"}
              variationType="neutral"
              loading={usuariosAdmin.isLoading}
            />

            <SummaryCard
              title="Logins Antigos (+30 dias)"
              value={loginsAntigosCount}
              subtitle="Eventos de login com mais de 30 dias em auditoria"
              icon={Clock}
              variant={loginsAntigosCount > 0 ? "warning" : "success"}
              variationType={loginsAntigosCount > 0 ? "negative" : "neutral"}
              loading={loginsAntigos.isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
