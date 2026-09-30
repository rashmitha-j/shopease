import { Link } from 'react-router';
import { useApi } from '../hooks/useApi.js';
import { formatPrice } from '../utils/format.js';
import { FREE_SHIPPING_THRESHOLD } from '../utils/orders.js';
import ProductGrid, { ProductGridSkeleton } from '../components/products/ProductGrid.jsx';
import CategoryIcon from '../components/products/CategoryIcon.jsx';
import { ErrorState } from '../components/ui/StatusMessage.jsx';

const FEATURED_COUNT = 8;

// Each category gets its own soft gradient; the icon sits on a white chip in the category's colour
const CATEGORY_STYLES = {
  Electronics: { card: 'from-sky-100 to-indigo-100', icon: 'text-indigo-600' },
  Fashion: { card: 'from-rose-100 to-pink-100', icon: 'text-rose-600' },
  Home: { card: 'from-amber-100 to-orange-100', icon: 'text-orange-600' },
  Books: { card: 'from-emerald-100 to-teal-100', icon: 'text-emerald-700' },
  Sports: { card: 'from-lime-100 to-green-100', icon: 'text-green-700' },
  Beauty: { card: 'from-fuchsia-100 to-purple-100', icon: 'text-purple-600' },
};
const DEFAULT_STYLE = { card: 'from-slate-100 to-slate-200', icon: 'text-slate-700' };

// Decorative product shots floating in the hero (files in client/public/products)
const HERO_IMAGES = [
  { src: '/products/wireless-noise-cancelling-headphones.webp', className: 'top-0 left-4 w-44 rotate-[-6deg] animate-float' },
  { src: '/products/everyday-running-sneakers.webp', className: 'top-10 right-0 w-40 rotate-[5deg] animate-float-slow' },
  { src: '/products/smart-fitness-watch.webp', className: 'bottom-0 left-16 w-36 rotate-[4deg] animate-float-slow' },
  { src: '/products/vitamin-c-face-serum.webp', className: 'right-10 bottom-6 w-32 rotate-[-4deg] animate-float' },
];

export default function HomePage() {
  return (
    <>
      <title>ShopEase | Shop electronics, fashion, home and more</title>

      <Hero />
      <CategoryTiles />
      <FeaturedProducts />
      <PromoBanner />
      <WhyShopWithUs />
    </>
  );
}

function Hero() {
  return (
    <section className="bg-brand-gradient relative isolate overflow-hidden rounded-3xl px-6 py-14 text-white sm:px-12 sm:py-20 lg:py-24">
      {/* Soft blurred colour blobs */}
      <div aria-hidden="true" className="absolute -top-24 -left-20 -z-10 size-80 rounded-full bg-fuchsia-400/40 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-16 -bottom-32 -z-10 size-96 rounded-full bg-sky-400/30 blur-3xl" />
      <div aria-hidden="true" className="absolute top-1/3 left-1/2 -z-10 size-64 rounded-full bg-pink-400/30 blur-3xl" />

      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ring-white/25 backdrop-blur">
            <span className="size-1.5 rounded-full bg-pink-300" aria-hidden="true" />
            New season picks
          </p>
          <h1 className="mt-5 text-4xl leading-tight font-extrabold sm:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]">
            Everything you love,
            <br />
            <span className="text-pink-200">delivered with ease.</span>
          </h1>
          <p className="mt-5 text-base text-indigo-50 sm:text-lg">
            Electronics, fashion, home, books, sports and beauty at great prices, with secure payments and free shipping
            over {formatPrice(FREE_SHIPPING_THRESHOLD)}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-brand-700 shadow-lg shadow-indigo-900/20 transition hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-purple-700 focus-visible:outline-none"
            >
              Shop now
              <span aria-hidden="true">→</span>
            </Link>
            <a
              href="#categories"
              className="inline-flex items-center rounded-xl px-6 py-3 font-semibold text-white ring-1 ring-white/50 transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              Browse categories
            </a>
          </div>
        </div>

        <div aria-hidden="true" className="relative hidden h-80 md:block lg:h-96">
          {HERO_IMAGES.map((image) => (
            <img
              key={image.src}
              src={image.src}
              alt=""
              width="800"
              height="800"
              className={`absolute aspect-square rounded-3xl object-cover shadow-2xl ring-4 shadow-indigo-950/40 ring-white/80 motion-reduce:animate-none ${image.className}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryTiles() {
  const { data, error } = useApi('/products/categories');
  if (error) return null; // the featured section below shows the error and a retry button

  return (
    <section id="categories" aria-labelledby="categories-heading" className="mt-16 scroll-mt-24">
      <SectionHeading id="categories-heading" title="Shop by category" subtitle="Find exactly what you’re after" />
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" aria-busy={!data}>
        {!data
          ? Array.from({ length: 6 }, (_, i) => <CategoryTileSkeleton key={i} />)
          : data.categories.map(({ name, count }) => {
              const style = CATEGORY_STYLES[name] ?? DEFAULT_STYLE;
              return (
                <li key={name}>
                  <Link
                    to={`/products?${new URLSearchParams({ category: name })}`}
                    className={`group flex h-36 flex-col items-center justify-center rounded-2xl bg-linear-to-br p-4 text-center ring-1 ring-slate-900/5 transition duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none ${style.card}`}
                  >
                    <span
                      className={`flex size-12 items-center justify-center rounded-2xl bg-white shadow-sm transition duration-200 group-hover:scale-110 ${style.icon}`}
                    >
                      <CategoryIcon category={name} className="size-6" />
                    </span>
                    <span className="mt-3 font-semibold text-slate-900">{name}</span>
                    <span className="text-xs text-slate-600">
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}

// Same shape as a category tile: icon chip, name and count
function CategoryTileSkeleton() {
  return (
    <li className="flex h-36 flex-col items-center justify-center gap-3 rounded-2xl bg-white ring-1 ring-slate-900/5" aria-hidden="true">
      <span className="skeleton size-12 rounded-2xl" />
      <span className="skeleton h-4 w-20 rounded-md" />
      <span className="skeleton h-3 w-12 rounded-md" />
    </li>
  );
}

function FeaturedProducts() {
  // The API has no "featured" filter, so fetch up to its maximum page size (100)
  // and pick the featured products here.
  const { data, error, retry } = useApi('/products?limit=100');
  const featured = data?.products.filter((p) => p.isFeatured).slice(0, FEATURED_COUNT);

  if (featured?.length === 0) return null;

  return (
    <section aria-labelledby="featured-heading" className="mt-16">
      <SectionHeading
        id="featured-heading"
        title="Featured products"
        subtitle="Hand-picked favourites from every category"
        action={
          <Link to="/products" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            View all <span aria-hidden="true">→</span>
          </Link>
        }
      />
      <div className="mt-6" aria-busy={!featured && !error}>
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !featured ? (
          <ProductGridSkeleton count={4} />
        ) : (
          <ProductGrid products={featured} />
        )}
      </div>
    </section>
  );
}

function PromoBanner() {
  return (
    <section
      aria-label="Offer"
      className="relative isolate mt-16 overflow-hidden rounded-3xl bg-linear-to-r from-orange-600 via-pink-600 to-purple-700 px-6 py-10 text-white sm:px-12"
    >
      <div aria-hidden="true" className="absolute -top-16 right-1/4 -z-10 size-56 rounded-full bg-yellow-300/30 blur-3xl" />
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <span className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 sm:flex">
            <TruckIcon className="size-7" />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">
              Free shipping on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}
            </h2>
            <p className="mt-1 text-orange-50">No code needed: it’s applied automatically at checkout.</p>
          </div>
        </div>
        <Link
          to="/products"
          className="shrink-0 rounded-xl bg-white px-6 py-3 font-semibold text-pink-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-pink-50 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-pink-600 focus-visible:outline-none"
        >
          Start shopping
        </Link>
      </div>
    </section>
  );
}

const PERKS = [
  {
    title: 'Secure payments',
    text: 'Pay by UPI, card, net banking or wallet through Razorpay’s secure checkout.',
    icon: ShieldIcon,
    style: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Fast delivery',
    text: 'Orders are packed quickly and you can follow every step from your orders page.',
    icon: TruckIcon,
    style: 'bg-pink-100 text-pink-700',
  },
  {
    title: 'Cash on delivery',
    text: 'Prefer to pay at the door? Choose cash on delivery at checkout.',
    icon: CashIcon,
    style: 'bg-amber-100 text-amber-700',
  },
];

function WhyShopWithUs() {
  return (
    <section aria-labelledby="why-heading" className="mt-16">
      <SectionHeading id="why-heading" title="Why shop with us" />
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {PERKS.map(({ title, text, icon: Icon, style }) => (
          <li key={title} className="card flex gap-4 p-6 transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${style}`}>
              <Icon className="size-6" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ id, title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-bold sm:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function TruckIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 6h11v10H2zM13 9h4l4 4v3h-8" />
      <circle cx="6" cy="18" r="2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.75 12 2.25 2.25 4.25-4.5" />
    </svg>
  );
}

function CashIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 9.5v5M18 9.5v5" />
    </svg>
  );
}
