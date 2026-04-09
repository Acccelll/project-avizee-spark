import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, permissionsLoaded } = useAuth();

  // Aguarda sessão + permissões antes de renderizar para evitar
  // flashes de conteúdo ou redirects incorretos enquanto roles carregam.
  if (loading || (user && !permissionsLoaded)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
