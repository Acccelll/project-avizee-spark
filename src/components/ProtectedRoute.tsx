import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { FullPageSpinner } from "@/components/ui/spinner";
import { useAuthGate } from "@/hooks/useAuthGate";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuthGate();

  if (status === "loading") {
    return <FullPageSpinner label="Carregando sessão..." />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
