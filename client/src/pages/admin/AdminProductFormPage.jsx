import { Link, useNavigate, useParams } from 'react-router';
import { useApi } from '../../hooks/useApi.js';
import { createProduct, updateProduct } from '../../api/products.js';
import ProductForm from '../../components/admin/ProductForm.jsx';
import { EMPTY_PRODUCT_VALUES, toProductPayload } from '../../utils/productForm.js';
import { EmptyState, ErrorState } from '../../components/ui/StatusMessage.jsx';

const backLink = (
  <Link to="/admin/products" className="text-sm font-medium text-brand-600 hover:text-brand-700">
    ← All products
  </Link>
);

// /admin/products/new
export function AdminNewProductPage() {
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    const payload = toProductPayload(values);
    const { product } = await createProduct({
      ...payload,
      mrp: payload.mrp ?? undefined, // leave MRP unset rather than null on a new product
      images: [{ url: values.imageUrl.trim() }],
    });
    navigate('/admin/products', { state: { flash: `“${product.name}” was added.` } });
  };

  return (
    <>
      <title>Admin: Add product | ShopEase</title>
      {backLink}
      <h1 className="mt-3 mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Add product</h1>
      <ProductForm
        initialValues={EMPTY_PRODUCT_VALUES}
        submitLabel="Add product"
        busyLabel="Adding…"
        onSubmit={handleSubmit}
      />
    </>
  );
}

// /admin/products/:slug/edit — loads the product through the public GET /api/products/:slug
export function AdminEditProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { data, error, retry } = useApi(`/products/${encodeURIComponent(slug)}`);

  if (error?.status === 404) {
    return (
      <>
        {backLink}
        <div className="mt-6">
          <EmptyState title="Product not found" message="It may have been deleted." />
        </div>
      </>
    );
  }
  if (error) return <ErrorState message={error.message} onRetry={retry} />;

  const product = data?.product;
  if (!product || product.slug !== slug.toLowerCase()) {
    return <div className="h-96 animate-pulse rounded-2xl bg-gray-200" aria-busy="true" aria-label="Loading product" />;
  }

  const [firstImage, ...otherImages] = product.images;

  const handleSubmit = async (values) => {
    const url = values.imageUrl.trim();
    const { product: saved } = await updateProduct(product._id, {
      ...toProductPayload(values),
      // Only the main image is edited here; any extra images are kept as they are
      images: [url === firstImage?.url ? firstImage : { url }, ...otherImages],
    });
    navigate('/admin/products', { state: { flash: `“${saved.name}” was updated.` } });
  };

  return (
    <>
      <title>{`Admin: Edit ${product.name} | ShopEase`}</title>
      {backLink}
      <div className="mt-3 mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit product</h1>
        <Link to={`/products/${product.slug}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
          View in store →
        </Link>
      </div>
      <ProductForm
        key={product._id}
        initialValues={{
          name: product.name,
          brand: product.brand,
          category: product.category,
          description: product.description,
          price: String(product.price),
          mrp: product.mrp == null ? '' : String(product.mrp),
          stock: String(product.stock),
          imageUrl: firstImage?.url ?? '',
          isFeatured: Boolean(product.isFeatured),
        }}
        submitLabel="Save changes"
        busyLabel="Saving…"
        onSubmit={handleSubmit}
      />
    </>
  );
}
