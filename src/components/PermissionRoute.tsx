/**
 * `PermissionRoute` — guard granular que combina autenticação + permissão.
 *
 * Substitui o uso genérico de `ProtectedRoute` em rotas que exigem mais do
 * que apenas estar logado. Bloqueia acesso direto via URL para usuários sem
 * o par (resource, action) requerido.
 */

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useCan } from "@/hooks/useCan";
import { humanizeResource, type ErpResource, type ErpAction } from "@/lib/permissions";

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
    return <AuthLoadingScreen mode="permissions" />;
  }
  if (gate.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (!can(`${resource}:${action}`)) {
    const label = humanizeResource(resource);
    return (
      <AccessDenied
        fullPage
        variant="route"
        title={deniedTitle ?? "Acesso restrito"}
        resourceLabel={label}
        permissionKey={`${resource}:${action}`}
        message={
          deniedMessage ??
          `Você não tem permissão para acessar ${label}. Solicite acesso ao administrador.`
        }
      />
    );
  }

  return <>{children}</>;
}
