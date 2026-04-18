import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSocialPermissionFlags } from '@/types/social';
import { FullPageSpinner } from '@/components/ui/spinner';
import { AccessDenied } from '@/components/AccessDenied';
import { useAuthGate } from '@/hooks/useAuthGate';

export function SocialRoute({ children }: { children: ReactNode }) {
  const gate = useAuthGate();
  const { roles, extraPermissions } = useAuth();

  if (gate.status === 'loading') {
    return <FullPageSpinner label="Verificando permissões..." />;
  }
  if (gate.status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  const permissions = getSocialPermissionFlags(roles, extraPermissions);
  if (!permissions.canViewModule) {
    return (
      <AccessDenied
        fullPage
        title="Módulo Social"
        message="Você não tem permissão para visualizar o módulo Social. Solicite acesso ao administrador."
      />
    );
  }

  return <>{children}</>;
}
