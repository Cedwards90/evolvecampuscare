import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCurrentNda, useMyNdaAcceptance } from '@/hooks/useNda';
import type { AppRole } from '@/types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  const { data: nda, isLoading: ndaLoading } = useCurrentNda();
  const { data: acceptance, isLoading: accLoading, isFetching: accFetching } = useMyNdaAcceptance(nda?.id);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    const redirect = next && next !== '/' ? `?redirect=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/auth${redirect}`} replace />;
  }

  // NDA gate — every signed-in user must accept the current NDA before
  // accessing any protected page. Excludes /accept-nda itself.
  if (ndaLoading || accLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (nda && !acceptance) {
    const next = `${location.pathname}${location.search}`;
    const redirect = next && next !== '/dashboard' ? `?redirect=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/accept-nda${redirect}`} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
