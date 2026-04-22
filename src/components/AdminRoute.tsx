import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCan } from "@/hooks/useCan";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthGate } from "@/hooks/useAuthGate";

export function AdminRoute({ children }: { children: ReactNode }) {
  const gate = useAuthGate();
  const { isAdmin } = useIsAdmin();
  const { can } = useCan();
  // Aceita override individual via `user_permissions` — alinha o guard com
  // `useVisibleNavSections`, que já mostra o item para quem tem
  // `administracao:visualizar` mesmo sem o papel `admin`.
  const canAccess = isAdmin || can("administracao:visualizar");

  if (gate.status === "loading") {
    return <AuthLoadingScreen mode="permissions" />;
  }
  if (gate.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  if (!canAccess) {
    return (
      <AccessDenied
        fullPage
        variant="route"
        title="Área administrativa"
        resourceLabel="Administração"
        permissionKey="administracao:visualizar"
        message="Esta seção é restrita a administradores. Solicite acesso ao responsável."
      />
    );
  }
  return <>{children}</>;
}
