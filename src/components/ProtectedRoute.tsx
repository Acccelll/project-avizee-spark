import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { FullPageSpinner } from "@/components/ui/spinner";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, permissionsLoaded } = useAuth();

  // Aguarda sessão + permissões antes de renderizar para evitar
  // flashes de conteúdo ou redirects incorretos enquanto roles carregam.
  if (loading || (user && !permissionsLoaded)) {
    return <FullPageSpinner />;
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
