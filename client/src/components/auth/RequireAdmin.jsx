import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';

// Route wrapper for admin pages. Visitors go to the login page; logged-in
// non-admins see a "no access" message. This only controls what the UI shows:
// the real protection is authorize('admin') on every admin API route.
export default function RequireAdmin() {
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

  if (user.role !== 'admin') {
    return (
      <>
        <title>Access denied | ShopEase</title>
        <section className="py-16 text-center">
          <p className="text-sm font-semibold text-brand-600">403</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">You don’t have access to this page</h1>
          <p className="mt-2 text-gray-600">The admin area is only available to administrators.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Go home
          </Link>
        </section>
      </>
    );
  }

  return <Outlet />;
}
