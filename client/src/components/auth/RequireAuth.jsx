import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';

// Route wrapper for pages that need a logged-in user. Visitors are sent to the
// login page, which brings them back here afterwards.
export default function RequireAuth() {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <p className="py-16 text-center text-sm text-gray-500" role="status">
        Loading…
      </p>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  return <Outlet />;
}
