import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';

export default function Footer() {
  const { user, status } = useAuth();

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} ShopEase. A MERN portfolio project.</p>
        <nav className="flex gap-4" aria-label="Footer">
          <Link to="/products" className="hover:text-gray-900">
            Products
          </Link>
          {status === 'ready' && !user && (
            <>
              <Link to="/login" className="hover:text-gray-900">
                Log in
              </Link>
              <Link to="/register" className="hover:text-gray-900">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </footer>
  );
}
