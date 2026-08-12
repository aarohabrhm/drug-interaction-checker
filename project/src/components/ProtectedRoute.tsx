import { Navigate, useLocation } from 'react-router-dom';
import { getAuthToken } from '../../utils/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Client-side gate for authenticated screens.
 *
 * This is a UX affordance only -- it stops an unauthenticated visitor from
 * landing on a broken dashboard. It is NOT a security control: anyone can edit
 * localStorage or call the API directly. Authorization is enforced server-side
 * by DRF's `IsAuthenticated` on every endpoint.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!getAuthToken()) {
    // `replace` keeps the unauthenticated URL out of history; `state` lets the
    // login screen send the user back where they were headed.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
