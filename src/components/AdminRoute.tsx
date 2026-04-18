import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { FullPageSpinner } from "@/components/ui/spinner";
import { AccessDenied } from "@/components/AccessDenied";

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  if (authLoading || roleLoading) {
    return <FullPageSpinner label="Verificando permissões..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <AccessDenied
        fullPage
        title="Área administrativa"
        message="Esta seção é restrita a administradores. Solicite acesso ao responsável."
      />
    );
  }
  return children;
}
