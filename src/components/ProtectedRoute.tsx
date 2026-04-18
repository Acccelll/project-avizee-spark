import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { AuthLoadingScreen } from "@/components/auth/AuthLoadingScreen";
import { useAuthGate } from "@/hooks/useAuthGate";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuthGate();

  if (status === "loading") {
    return <AuthLoadingScreen mode="session" />;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
