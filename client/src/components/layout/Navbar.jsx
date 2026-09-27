import { useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router';

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/products', label: 'Products' },
];

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'text-brand-600' : 'text-gray-700 hover:text-brand-600'
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
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
      <input
        // key resets the input when the URL's search term changes (e.g. back button)
        key={currentQuery}
        id={`search-${onSearch ? 'mobile' : 'desktop'}`}
        name="q"
        type="search"
        defaultValue={currentQuery}
        placeholder="Search products…"
        maxLength={100}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
    </form>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8" aria-label="Main">
        <Link to="/" onClick={closeMenu} className="flex shrink-0 items-center gap-2 text-lg font-bold text-gray-900">
          <img src="/favicon.svg" alt="" className="size-8" />
          ShopEase
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

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <Link to="/login" className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:text-brand-600">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            Sign up
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="space-y-3 border-t border-gray-200 px-4 pt-3 pb-4 md:hidden">
          <SearchForm onSearch={closeMenu} />
          <div className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} onClick={closeMenu} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-gray-200 pt-3">
            <Link
              to="/login"
              onClick={closeMenu}
              className="rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log in
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </header>
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
