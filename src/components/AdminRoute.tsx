import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { FullPageSpinner } from "@/components/ui/spinner";
import { AccessDenied } from "@/components/AccessDenied";
import { useAuthGate } from "@/hooks/useAuthGate";

export function AdminRoute({ children }: { children: ReactNode }) {
  const gate = useAuthGate();
  const { isAdmin } = useIsAdmin();

  if (gate.status === "loading") {
    return <FullPageSpinner label="Verificando permissões..." />;
  }
  if (gate.status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return (
      <AccessDenied
        fullPage
        title="Área administrativa"
        message="Esta seção é restrita a administradores. Solicite acesso ao responsável."
      />
    );
  }
  return <>{children}</>;
}
