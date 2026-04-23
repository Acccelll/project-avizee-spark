import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSocialPermissionFlags } from '@/types/social';
import { AuthLoadingScreen } from '@/components/auth/AuthLoadingScreen';
import { AccessDenied } from '@/components/AccessDenied';
import { useAuthGate } from '@/hooks/useAuthGate';

export function SocialRoute({ children }: { children: ReactNode }) {
  const gate = useAuthGate();
  const { roles, extraPermissions, deniedPermissions } = useAuth();
  const location = useLocation();

  if (gate.status === 'loading') {
    return <AuthLoadingScreen mode="permissions" />;
  }
  if (gate.status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const permissions = getSocialPermissionFlags(roles, extraPermissions, deniedPermissions);
  if (!permissions.canViewModule) {
    return (
      <AccessDenied
        fullPage
        variant="route"
        title="Módulo Social"
        resourceLabel="Social"
        permissionKey="social:visualizar"
      />
    );
  }

  return <>{children}</>;
}
