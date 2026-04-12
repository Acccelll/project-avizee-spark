/**
 * DashboardAdmin — widgets de monitoramento de segurança para o módulo Admin.
 *
 * Exibe:
 *  - Tentativas de login falhas nas últimas 24 h
 *  - Usuários com permissões administrativas
 *  - Sessões inativas há mais de 30 dias
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

async function fetchSessoesInativas(): Promise<number> {
  // user_sessions table may not exist; return 0 gracefully
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("auditoria_logs" as any)
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

  const sessoesInativas = useQuery({
    queryKey: ["admin", "security", "sessoes-inativas"],
    queryFn: fetchSessoesInativas,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const loginsFalhosCount = loginsFalhos.data ?? 0;
  const usuariosAdminCount = usuariosAdmin.data ?? 0;
  const sessoesInativasCount = sessoesInativas.data ?? 0;

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
              title="Sessões Inativas (+30 dias)"
              value={sessoesInativasCount}
              subtitle="Sessões ativas há mais de 30 dias sem uso"
              icon={Clock}
              variant={sessoesInativasCount > 0 ? "warning" : "success"}
              variationType={sessoesInativasCount > 0 ? "negative" : "neutral"}
              loading={sessoesInativas.isLoading}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
