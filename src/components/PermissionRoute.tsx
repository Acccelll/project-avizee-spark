/**
 * `PermissionRoute` — guard granular que combina autenticação + permissão.
 *
 * Substitui o uso genérico de `ProtectedRoute` em rotas que exigem mais do
 * que apenas estar logado. Bloqueia acesso direto via URL para usuários sem
 * o par (resource, action) requerido — fechando o gap de "menu esconde
 * mas rota libera".
 *
 * Estados:
 *  - Sem sessão → redireciona para `/login`
 *  - Sem permissão → renderiza `<AccessDenied fullPage />`
 *  - OK → renderiza `children`
 */

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { FullPageSpinner } from "@/components/ui/spinner";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useCan } from "@/hooks/useCan";
import type { ErpResource, ErpAction } from "@/lib/permissions";

interface PermissionRouteProps {
  resource: ErpResource;
  action?: ErpAction;
  children: ReactNode;
  /** Título customizado para o estado "sem permissão". */
  deniedTitle?: string;
  /** Mensagem customizada para o estado "sem permissão". */
  deniedMessage?: string;
}

export function PermissionRoute({
  resource,
  action = "visualizar",
  children,
  deniedTitle,
  deniedMessage,
}: PermissionRouteProps) {
  const gate = useAuthGate();
  const { can } = useCan();

  if (gate.status === "loading") {
    return <FullPageSpinner label="Verificando permissões..." />;
  }
  if (gate.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!can(`${resource}:${action}`)) {
    return (
      <AccessDenied
        fullPage
        title={deniedTitle ?? "Acesso restrito"}
        message={
          deniedMessage ??
          `Você não tem permissão para acessar este módulo (${resource}). Solicite acesso ao administrador.`
        }
      />
    );
  }

  return <>{children}</>;
}
