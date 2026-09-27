import Product, { CATEGORIES } from '../models/Product.js';
import AppError from '../utils/AppError.js';
import { escapeRegex } from '../utils/strings.js';

// Only these fields can be set through the API. rating, numReviews, slug and
// createdBy are managed by the server, so they are never taken from req.body.
const EDITABLE_FIELDS = ['name', 'description', 'brand', 'category', 'price', 'mrp', 'images', 'stock', 'isFeatured'];

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1, numReviews: -1 },
};

const pickEditable = (body = {}) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

// `?a=1&a=2` arrives as an array; use the first value and always work with strings
const queryString = (value) => {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() : '';
};

const queryNumber = (value, name) => {
  const str = queryString(value);
  if (!str) return undefined;
  const num = Number(str);
  if (!Number.isFinite(num) || num < 0) throw new AppError(`${name} must be a non-negative number`, 400);
  return num;
};

// GET /api/products?q=&category=&brand=&minPrice=&maxPrice=&minRating=&inStock=true&sort=&page=&limit=
export const getProducts = async (req, res) => {
  const q = queryString(req.query.q).slice(0, 100);
  const category = queryString(req.query.category);
  const brand = queryString(req.query.brand);
  const sort = queryString(req.query.sort) || 'newest';
  const minPrice = queryNumber(req.query.minPrice, 'minPrice');
  const maxPrice = queryNumber(req.query.maxPrice, 'maxPrice');
  const minRating = queryNumber(req.query.minRating, 'minRating');

  const page = Math.max(parseInt(queryString(req.query.page), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryString(req.query.limit), 10) || 12, 1), 100);

  const filter = {};

  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: pattern }, { brand: pattern }];
  }

  if (category) {
    const match = CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase());
    if (!match) throw new AppError(`Category must be one of: ${CATEGORIES.join(', ')}`, 400);
    filter.category = match;
  }

  if (brand) filter.brand = new RegExp(`^${escapeRegex(brand)}$`, 'i');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new AppError('minPrice cannot be greater than maxPrice', 400);
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = minPrice;
    if (maxPrice !== undefined) filter.price.$lte = maxPrice;
  }

  if (minRating !== undefined) {
    if (minRating > 5) throw new AppError('minRating must be between 0 and 5', 400);
    filter.rating = { $gte: minRating };
  }

  if (queryString(req.query.inStock) === 'true') filter.stock = { $gt: 0 };

  if (!SORT_OPTIONS[sort]) {
    throw new AppError(`sort must be one of: ${Object.keys(SORT_OPTIONS).join(', ')}`, 400);
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      // _id as a tie-breaker keeps pagination stable when sort values are equal
      .sort({ ...SORT_OPTIONS[sort], _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    products,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
};

// GET /api/products/categories  -> every category with its product count
export const getCategories = async (req, res) => {
  const counts = await Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  const countByName = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    success: true,
    categories: CATEGORIES.map((name) => ({ name, count: countByName[name] || 0 })),
  });
};

// GET /api/products/:slug
export const getProduct = async (req, res) => {
  const product = await Product.findOne({ slug: String(req.params.slug).toLowerCase() });
  if (!product) throw new AppError('Product not found', 404);

  res.json({ success: true, product });
};

// POST /api/products  (admin)
export const createProduct = async (req, res) => {
  const product = await Product.create({ ...pickEditable(req.body), createdBy: req.user._id });
  res.status(201).json({ success: true, product });
};

// PATCH /api/products/:id  (admin)
export const updateProduct = async (req, res) => {
  const updates = pickEditable(req.body);
  if (!Object.keys(updates).length) throw new AppError('No valid fields to update', 400);

  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  // set() + save() (instead of findByIdAndUpdate) so every validator runs,
  // including the mrp >= price check that compares two fields
  product.set(updates);
  await product.save();

  res.json({ success: true, product });
};

// DELETE /api/products/:id  (admin)
export const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);

  res.json({ success: true, message: 'Product deleted' });
};
