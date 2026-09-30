import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';
import { useCart } from '../../hooks/useCart.js';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
];

const navLinkClass = ({ isActive }) =>
  `rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100 hover:text-brand-700'
  }`;

function SearchForm({ onSearch, className = '' }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentQuery = searchParams.get('q') ?? '';

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q').trim();
    navigate(q ? `/products?${new URLSearchParams({ q })}` : '/products');
    onSearch?.();
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative ${className}`}>
      <label htmlFor={`search-${onSearch ? 'mobile' : 'desktop'}`} className="sr-only">
        Search products
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        // key resets the input when the URL's search term changes (e.g. back button)
        key={currentQuery}
        id={`search-${onSearch ? 'mobile' : 'desktop'}`}
        name="q"
        type="search"
        defaultValue={currentQuery}
        placeholder="Search products…"
        maxLength={100}
        className="w-full rounded-xl border border-transparent bg-slate-100 py-2.5 pr-3 pl-9 text-sm placeholder:text-slate-500 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
    </form>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const { user, status, logout } = useAuth();
  const location = useLocation();

  // Return to the current page after logging in. On the login/register pages
  // themselves, keep passing along wherever the user originally came from.
  const onAuthPage = ['/login', '/register'].includes(location.pathname);
  const authLinkState = onAuthPage ? location.state : { from: location.pathname + location.search };

  const handleLogout = async () => {
    closeMenu();
    await logout();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 shadow-sm shadow-slate-900/5 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link to="/" onClick={closeMenu} className="flex shrink-0 items-center gap-2 text-xl font-extrabold">
          <img src="/favicon.svg" alt="" className="size-9" />
          <span className="text-brand-gradient">ShopEase</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={navLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </div>

        <SearchForm className="mx-auto hidden w-full max-w-md md:block" />

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          {status === 'loading' ? (
            // Reserve the space while the session is being restored, so the navbar doesn't jump
            <div className="h-9 w-36" aria-hidden="true" />
          ) : user ? (
            <>
              {user.role === 'admin' && (
                // Icon only between md and lg, where the navbar is tight; icon + text from lg
                <NavLink to="/admin" className={(state) => `inline-flex items-center gap-1.5 ${navLinkClass(state)}`}>
                  <DashboardIcon className="size-5" />
                  <span className="sr-only lg:not-sr-only">Admin</span>
                </NavLink>
              )}
              <NavLink to="/orders" className={navLinkClass}>
                My orders
              </NavLink>
              <UserBadge user={user} />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-700 hover:text-brand-600"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                state={authLinkState}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:text-brand-600"
              >
                Log in
              </Link>
              <Link
                to="/register"
                state={authLinkState}
                className="btn-primary px-4 py-2"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <CartLink onClick={closeMenu} />

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-md p-2 text-slate-700 hover:bg-slate-100 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="space-y-3 border-t border-slate-200 px-4 pt-3 pb-4 md:hidden">
          <SearchForm onSearch={closeMenu} />
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>
          {status === 'ready' && (
            <div className="border-t border-slate-200 pt-3">
              {user ? (
                <>
                  {user.role === 'admin' && (
                    <NavLink
                      to="/admin"
                      onClick={closeMenu}
                      className={({ isActive }) => `mb-1 block ${navLinkClass({ isActive })}`}
                    >
                      Admin
                    </NavLink>
                  )}
                  <NavLink
                    to="/orders"
                    onClick={closeMenu}
                    className={({ isActive }) => `mb-3 block ${navLinkClass({ isActive })}`}
                  >
                    My orders
                  </NavLink>
                  <div className="flex items-center justify-between gap-3">
                    <UserBadge user={user} showEmail />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="btn-secondary px-4 py-2"
                    >
                      Log out
                    </button>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/login"
                    state={authLinkState}
                    onClick={closeMenu}
                    className="btn-secondary px-4 py-2"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    state={authLinkState}
                    onClick={closeMenu}
                    className="btn-primary px-4 py-2"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}

function CartLink({ onClick }) {
  const { totals } = useCart();
  const count = totals.count;

  return (
    <NavLink
      to="/cart"
      onClick={onClick}
      aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
      className={({ isActive }) =>
        `relative ml-auto rounded-md p-2 hover:bg-slate-100 md:ml-0 ${isActive ? 'text-brand-600' : 'text-slate-700'}`
      }
    >
      <CartIcon className="size-6" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-to-r from-pink-600 to-rose-600 px-1 text-xs font-semibold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  );
}

function UserBadge({ user, showEmail = false }) {
  const firstName = user.name.split(' ')[0];

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
        title={user.name}
        aria-hidden="true"
      >
        {user.name.charAt(0).toUpperCase()}
      </span>
      {/* In the desktop navbar the name only fits from lg up; the avatar alone is shown on md */}
      <div className={`min-w-0 text-sm leading-tight ${showEmail ? '' : 'sr-only lg:not-sr-only'}`}>
        <p className="flex items-center gap-1.5 font-medium text-slate-900">
          <span className="max-w-40 truncate">Hi, {firstName}</span>
          {user.role === 'admin' && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">Admin</span>
          )}
        </p>
        {showEmail && <p className="truncate text-slate-500">{user.email}</p>}
      </div>
    </div>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.39c.51 0 .95.34 1.09.83l.38 1.42m0 0L6.6 12.1a1.5 1.5 0 0 0 1.45 1.15h9.1a1.5 1.5 0 0 0 1.45-1.1l1.65-6.02a.75.75 0 0 0-.72-.95H5.11ZM9 19.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
      />
    </svg>
  );
}

function DashboardIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <path
        strokeLinejoin="round"
        d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5Zm0 8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-6Zm-9 3a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3Z"
      />
    </svg>
  );
}

function MenuIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
