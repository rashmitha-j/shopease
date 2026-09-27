import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { deleteProduct } from '../../api/products.js';
import { formatPrice } from '../../utils/format.js';
import Pagination from '../../components/products/Pagination.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState } from '../../components/ui/StatusMessage.jsx';

const PAGE_SIZE = 20;
const LOW_STOCK = 5; // same threshold as the dashboard and the storefront

const stockStatus = (stock) =>
  stock === 0
    ? { label: 'Out of stock', className: 'bg-red-100 text-red-800' }
    : stock <= LOW_STOCK
      ? { label: 'Low stock', className: 'bg-amber-100 text-amber-800' }
      : { label: 'In stock', className: 'bg-green-100 text-green-800' };

export default function AdminProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const q = searchParams.get('q')?.trim() ?? '';
  const category = searchParams.get('category') ?? '';
  const page = Math.max(Number.parseInt(searchParams.get('page'), 10) || 1, 1);

  // Reuses the public product list API (newest first)
  const apiParams = new URLSearchParams({ page, limit: PAGE_SIZE, sort: 'newest' });
  if (q) apiParams.set('q', q);
  if (category) apiParams.set('category', category);
  const { data, error, loading, retry } = useApi(`/products?${apiParams}`);
  const { data: categoryData } = useApi('/products/categories');

  // Success message passed from the add/edit pages, or set after a delete
  const [flash, setFlash] = useState(() => location.state?.flash ?? '');
  useEffect(() => {
    // Clear it from history so it doesn't reappear on reload or "back"
    if (location.state?.flash) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [location, navigate]);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const updateFilters = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete('page');
    setSearchParams(next);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteProduct(toDelete._id);
      setFlash(`“${toDelete.name}” was deleted.`);
      setToDelete(null);
      retry();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openDelete = (product) => {
    setDeleteError('');
    setFlash('');
    setToDelete(product);
  };

  return (
    <>
      <title>Admin: Products | ShopEase</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Products</h1>
        <Link
          to="/admin/products/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          + Add product
        </Link>
      </div>

      {flash && (
        <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{flash}</span>
          <button type="button" onClick={() => setFlash('')} className="font-medium hover:text-green-950" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form
          role="search"
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateFilters({ q: new FormData(e.currentTarget).get('q').trim() });
          }}
        >
          <label htmlFor="admin-product-search" className="sr-only">
            Search products
          </label>
          <input
            key={q}
            id="admin-product-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name or brand"
            maxLength={100}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <button type="submit" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Search
          </button>
        </form>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="sr-only sm:not-sr-only">Category</span>
          <select
            value={category}
            onChange={(e) => updateFilters({ category: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-8 pl-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:w-auto"
          >
            <option value="">All categories</option>
            {categoryData?.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5">
        {error ? (
          <ErrorState message={error.message} onRetry={retry} />
        ) : !data ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading products">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
        ) : data.products.length === 0 ? (
          <EmptyState
            title={q || category ? 'No products match' : 'No products yet'}
            message={q || category ? 'Try a different search or category.' : 'Add your first product to start selling.'}
          >
            {q || category ? (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Clear filters
              </button>
            ) : (
              <Link to="/admin/products/new" className="inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                Add product
              </Link>
            )}
          </EmptyState>
        ) : (
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
            <p className="mb-2 text-sm text-gray-600" aria-live="polite">
              {data.total} {data.total === 1 ? 'product' : 'products'}
            </p>
            <ProductTable products={data.products} onDelete={openDelete} />
            <ProductCards products={data.products} onDelete={openDelete} />
            <div className="mt-6">
              <Pagination
                page={data.page}
                pages={data.pages}
                getSearch={(n) => {
                  const next = new URLSearchParams(searchParams);
                  if (n === 1) next.delete('page');
                  else next.set('page', n);
                  return next.toString() ? `?${next}` : '';
                }}
              />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this product?"
        message={
          toDelete && (
            <>
              <p>
                <strong className="font-semibold text-gray-900">{toDelete.name}</strong> will be removed from the store. This can’t be
                undone.
              </p>
              <p className="mt-2">Past orders keep their own copy of the product, so order history is not affected.</p>
            </>
          )
        }
        confirmLabel="Delete product"
        busy={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

function Thumb({ product }) {
  return product.images?.[0]?.url ? (
    <img src={product.images[0].url} alt="" loading="lazy" className="size-12 shrink-0 rounded-md border border-gray-200 object-cover" />
  ) : (
    <span className="block size-12 shrink-0 rounded-md bg-gray-100" />
  );
}

function StatusBadges({ product }) {
  const status = stockStatus(product.stock);
  return (
    <span className="flex flex-wrap gap-1">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${status.className}`}>{status.label}</span>
      {product.isFeatured && (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-brand-700">Featured</span>
      )}
    </span>
  );
}

function Actions({ product, onDelete }) {
  return (
    <span className="flex items-center justify-end gap-3 text-sm font-medium">
      <Link to={`/admin/products/${product.slug}/edit`} className="text-brand-600 hover:text-brand-700" aria-label={`Edit ${product.name}`}>
        Edit
      </Link>
      <button type="button" onClick={() => onDelete(product)} className="text-red-600 hover:text-red-700" aria-label={`Delete ${product.name}`}>
        Delete
      </button>
    </span>
  );
}

function Price({ product }) {
  return (
    <>
      {formatPrice(product.price)}
      {product.mrp > product.price && <span className="ml-1 text-xs text-gray-400 line-through">{formatPrice(product.mrp)}</span>}
    </>
  );
}

// Desktop: table
function ProductTable({ products, onDelete }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-gray-200 bg-white md:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs tracking-wide text-gray-500 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Product</th>
            <th scope="col" className="px-4 py-3 font-medium">Category</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Price</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Stock</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => (
            <tr key={p._id}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Thumb product={p} />
                  <div className="min-w-0">
                    <p className="line-clamp-2 font-medium text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.brand}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{p.category}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                <Price product={p} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{p.stock}</td>
              <td className="px-4 py-3">
                <StatusBadges product={p} />
              </td>
              <td className="px-4 py-3">
                <Actions product={p} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Phones: cards
function ProductCards({ products, onDelete }) {
  return (
    <ul className="space-y-3 md:hidden">
      {products.map((p) => (
        <li key={p._id} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex gap-3">
            <Thumb product={p} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium text-gray-900">{p.name}</p>
              <p className="text-xs text-gray-500">
                {p.brand} · {p.category}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="tabular-nums">
              <Price product={p} /> · <span className="text-gray-600">{p.stock} in stock</span>
            </span>
            <StatusBadges product={p} />
          </div>
          <div className="mt-3 border-t border-gray-100 pt-3">
            <Actions product={p} onDelete={onDelete} />
          </div>
        </li>
      ))}
    </ul>
  );
}
