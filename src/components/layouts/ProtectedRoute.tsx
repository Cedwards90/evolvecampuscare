import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useCurrentNda, useMyNdaAcceptance } from '@/hooks/useNda';
import { useOnboardingStatus, ONBOARDING_PATHS, ONBOARDING_STEP_PATH } from '@/hooks/useOnboardingStatus';
import type { AppRole } from '@/types/database';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, profile, isLoading } = useAuth();
  const location = useLocation();

  if (profile?.deactivated_at) {
    return <Navigate to="/auth?reason=deactivated" replace />;
  }

  const { data: nda, isLoading: ndaLoading } = useCurrentNda();
  const { data: acceptance, isLoading: accLoading, isFetching: accFetching } = useMyNdaAcceptance(nda?.id);
  const onboarding = useOnboardingStatus();

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
  if (ndaLoading || accLoading || accFetching) {
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

  // Student onboarding gate — students must complete all onboarding steps before
  // accessing any non-onboarding protected page. Staff/admin/org_admin bypass.
  if (role === 'student' && !onboarding.loading && onboarding.nextStep) {
    const targetPath = ONBOARDING_STEP_PATH[onboarding.nextStep];
    if (!ONBOARDING_PATHS.has(location.pathname) && location.pathname !== targetPath) {
      return <Navigate to={targetPath} replace />;
    }
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
