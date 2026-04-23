import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { useAuthGate } from "@/hooks/useAuthGate";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuthGate();
  const location = useLocation();

  if (status === "loading") {
    return <AuthLoadingScreen mode="session" />;
  }
  if (status === "unauthenticated") {
    // Preserva a rota de origem para que o Login possa redirecionar de volta
    // ao destino original após autenticação bem-sucedida (deep-link / sessão expirada).
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
