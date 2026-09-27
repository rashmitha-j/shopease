import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import AppError from '../utils/AppError.js';

const SORT_OPTIONS = {
  newest: { createdAt: -1, _id: -1 },
  highest: { rating: -1, createdAt: -1, _id: -1 },
  lowest: { rating: 1, createdAt: -1, _id: -1 },
};

// Only these fields come from the request; product, user, order and status never do
const pickReviewFields = (body = {}) =>
  Object.fromEntries(['rating', 'comment'].filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

const findProductBySlug = async (slug) => {
  const product = await Product.findOne({ slug: String(slug).toLowerCase() }).select('_id name slug');
  if (!product) throw new AppError('Product not found', 404);
  return product;
};

// A delivered order containing the product = a verified purchase
const findDeliveredOrder = (userId, productId) =>
  Order.findOne({ user: userId, status: 'delivered', 'items.product': productId }).select('_id');

const isDuplicateKey = (err) => err?.code === 11000;
const ALREADY_REVIEWED = 'You’ve already reviewed this product. You can edit your review instead.';

// GET /api/products/:slug/reviews?sort=newest|highest|lowest&page=&limit=   (public)
export const listProductReviews = async (req, res) => {
  const product = await findProductBySlug(req.params.slug);
  const sortKey = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
  if (!SORT_OPTIONS[sortKey]) throw new AppError(`sort must be one of: ${Object.keys(SORT_OPTIONS).join(', ')}`, 400);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
  const filter = { product: product._id, status: 'published' };

  const [reviews, byRating] = await Promise.all([
    Review.find(filter)
      .sort(SORT_OPTIONS[sortKey])
      .skip((page - 1) * limit)
      .limit(limit)
      .select('rating comment createdAt updatedAt user')
      .populate('user', 'name'),
    Review.aggregate([{ $match: filter }, { $group: { _id: '$rating', count: { $sum: 1 } } }]),
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const { _id, count } of byRating) distribution[_id] = count;
  const total = byRating.reduce((sum, r) => sum + r.count, 0);
  const average = total ? Math.round((byRating.reduce((sum, r) => sum + r._id * r.count, 0) / total) * 10) / 10 : 0;

  res.json({
    success: true,
    reviews,
    page,
    pages: Math.ceil(total / limit),
    total,
    summary: { average, count: total, distribution },
  });
};

// GET /api/products/:slug/reviews/me   -> can the logged-in customer review this product?
export const getMyReviewStatus = async (req, res) => {
  const product = await findProductBySlug(req.params.slug);
  const myReview = await Review.findOne({ product: product._id, user: req.user._id }).select('-moderatedBy');
  if (myReview) return res.json({ success: true, canReview: false, reason: 'already_reviewed', myReview });

  const order = await findDeliveredOrder(req.user._id, product._id);
  res.json({ success: true, canReview: Boolean(order), reason: order ? null : 'not_purchased', myReview: null });
};

// POST /api/products/:slug/reviews   { rating, comment }   (logged in + delivered purchase)
export const createReview = async (req, res) => {
  const product = await findProductBySlug(req.params.slug);

  if (await Review.exists({ product: product._id, user: req.user._id })) throw new AppError(ALREADY_REVIEWED, 409);

  const order = await findDeliveredOrder(req.user._id, product._id);
  if (!order) throw new AppError('Only customers who have received this product can review it.', 403);

  let review;
  try {
    review = await Review.create({ ...pickReviewFields(req.body), product: product._id, user: req.user._id, order: order._id });
  } catch (err) {
    // Two submissions at the same moment: the unique index lets only one through
    if (isDuplicateKey(err)) throw new AppError(ALREADY_REVIEWED, 409);
    throw err;
  }

  await Review.recalculateProductRating(product._id);
  res.status(201).json({ success: true, review });
};

// PATCH /api/reviews/:id   { rating?, comment? }   (author only)
export const updateMyReview = async (req, res) => {
  const updates = pickReviewFields(req.body);
  if (!Object.keys(updates).length) throw new AppError('Nothing to update: send a rating and/or comment', 400);
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid review id', 400);

  // Looking up by id AND author: someone else's review is simply "not found"
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) throw new AppError('Review not found', 404);

  review.set(updates); // status is not touched: editing never un-hides a hidden review
  await review.save();
  await Review.recalculateProductRating(review.product);
  res.json({ success: true, review });
};

// DELETE /api/reviews/:id   (author only)
export const deleteMyReview = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid review id', 400);
  const review = await Review.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!review) throw new AppError('Review not found', 404);

  await Review.recalculateProductRating(review.product);
  res.json({ success: true, message: 'Review deleted' });
};
