import Review, { REVIEW_STATUSES } from '../models/Review.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import { escapeRegex } from '../utils/strings.js';

const withDetails = (query) => query.populate('product', 'name slug images').populate('user', 'name email');

// GET /api/admin/reviews?status=&rating=&q=&page=&limit=
// q matches the review text, the product name, or the customer's name/email.
export const listReviews = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const rating = typeof req.query.rating === 'string' ? req.query.rating.trim() : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';

  const filter = {};
  if (status) {
    if (!REVIEW_STATUSES.includes(status)) throw new AppError('status must be published or hidden', 400);
    filter.status = status;
  }
  if (rating) {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) throw new AppError('rating must be a whole number from 1 to 5', 400);
    filter.rating = n;
  }
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    const [products, users] = await Promise.all([
      Product.find({ name: pattern }).select('_id').limit(200),
      User.find({ $or: [{ name: pattern }, { email: pattern }] }).select('_id').limit(200),
    ]);
    filter.$or = [
      { comment: pattern },
      { product: { $in: products.map((p) => p._id) } },
      { user: { $in: users.map((u) => u._id) } },
    ];
  }

  const [reviews, total] = await Promise.all([
    withDetails(Review.find(filter))
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments(filter),
  ]);

  res.json({ success: true, reviews, page, pages: Math.ceil(total / limit), total });
};

// PATCH /api/admin/reviews/:id   { status: 'hidden' | 'published', note? }
export const moderateReview = async (req, res) => {
  const { status, note } = req.body ?? {};
  if (!REVIEW_STATUSES.includes(status)) throw new AppError('status must be published or hidden', 400);

  const review = await Review.findById(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  review.status = status;
  review.moderatedBy = req.user._id;
  review.moderatedAt = new Date();
  review.moderationNote = status === 'hidden' && typeof note === 'string' && note.trim() ? note.trim() : undefined;
  await review.save();
  await Review.recalculateProductRating(review.product);

  res.json({ success: true, review: await withDetails(Review.findById(review._id)) });
};

// DELETE /api/admin/reviews/:id   (permanent)
export const deleteReview = async (req, res) => {
  const review = await Review.findByIdAndDelete(req.params.id);
  if (!review) throw new AppError('Review not found', 404);

  await Review.recalculateProductRating(review.product);
  res.json({ success: true, message: 'Review deleted' });
};
