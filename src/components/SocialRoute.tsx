import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSocialPermissionFlags } from '@/types/social';

export function SocialRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, permissionsLoaded, roles } = useAuth();

  if (loading || !permissionsLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const permissions = getSocialPermissionFlags(roles);
  if (!permissions.canViewModule) return <Navigate to="/" replace />;

  return <>{children}</>;
}
