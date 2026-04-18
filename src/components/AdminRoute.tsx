import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthGate } from "@/hooks/useAuthGate";

export function AdminRoute({ children }: { children: ReactNode }) {
  const gate = useAuthGate();
  const { isAdmin } = useIsAdmin();

  if (gate.status === "loading") {
    return <AuthLoadingScreen mode="permissions" />;
  }
  if (gate.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
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
