import { Link } from 'react-router';
import { useAuth } from '../../hooks/useAuth.js';
import { formatPrice } from '../../utils/format.js';
import { FREE_SHIPPING_THRESHOLD } from '../../utils/orders.js';

const REPO_URL = 'https://github.com/rashmitha-j/Shopease';
const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Beauty'];

const linkClass = 'text-sm text-slate-300 transition hover:text-white';

export default function Footer() {
  const { user, status } = useAuth();

  return (
    <footer className="relative mt-20 overflow-hidden bg-slate-950 text-slate-300">
      <div aria-hidden="true" className="h-1 bg-linear-to-r from-brand-500 via-purple-500 to-pink-500" />
      <div aria-hidden="true" className="absolute -top-24 right-0 size-72 rounded-full bg-purple-600/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr] lg:px-8">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold text-white">
            <img src="/favicon.svg" alt="" className="size-8" />
            ShopEase
          </Link>
          <p className="mt-3 max-w-xs text-sm text-slate-400">
            Electronics, fashion, home, books, sports and beauty, with free shipping on orders over{' '}
            {formatPrice(FREE_SHIPPING_THRESHOLD)}.
          </p>
          <ul className="mt-5 flex gap-3" aria-label="Social links">
            <li>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="ShopEase on GitHub (opens in a new tab)"
                className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                <GitHubIcon className="size-5" />
              </a>
            </li>
          </ul>
        </div>

        <FooterColumn title="Shop">
          <li>
            <Link to="/products" className={linkClass}>
              All products
            </Link>
          </li>
          {CATEGORIES.slice(0, 4).map((category) => (
            <li key={category}>
              <Link to={`/products?${new URLSearchParams({ category })}`} className={linkClass}>
                {category}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Account">
          {status === 'ready' && !user ? (
            <>
              <li>
                <Link to="/login" className={linkClass}>
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/register" className={linkClass}>
                  Create account
                </Link>
              </li>
            </>
          ) : (
            user && (
              <li>
                <Link to="/orders" className={linkClass}>
                  My orders
                </Link>
              </li>
            )
          )}
          <li>
            <Link to="/cart" className={linkClass}>
              Cart
            </Link>
          </li>
        </FooterColumn>

        <FooterColumn title="Help">
          <li>
            <Link to="/orders" className={linkClass}>
              Track an order
            </Link>
          </li>
          <li>
            <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className={linkClass}>
              Report a problem
            </a>
          </li>
          <li className="text-sm text-slate-400">Payments secured by Razorpay</li>
        </FooterColumn>
      </div>

      <div className="relative border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-slate-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} ShopEase. A MERN portfolio project.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-semibold tracking-wider text-white uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5">{children}</ul>
    </nav>
  );
}

function GitHubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49l-.01-1.7c-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.6.69.49A10.1 10.1 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
