import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSocialPermissionFlags } from '@/types/social';
import { FullPageSpinner } from '@/components/ui/spinner';
import { AccessDenied } from '@/components/AccessDenied';

export function SocialRoute({ children }: { children: ReactNode }) {
  const { user, loading, permissionsLoaded, roles } = useAuth();

  if (loading || !permissionsLoaded) {
    return <FullPageSpinner label="Verificando permissões..." />;
  }

  if (!user) return <Navigate to="/login" replace />;

  const permissions = getSocialPermissionFlags(roles);
  if (!permissions.canViewModule) {
    return (
      <AccessDenied
        fullPage
        title="Módulo Social"
        message="Você não tem permissão para visualizar o módulo Social. Solicite acesso ao administrador."
      />
    );
  }

  return children;
}
