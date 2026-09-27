import mongoose from 'mongoose';
import Product from './Product.js';

export const REVIEW_STATUSES = ['published', 'hidden'];

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // The delivered order that made this customer eligible to review
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be between 1 and 5'],
      max: [5, 'Rating must be between 1 and 5'],
      validate: { validator: Number.isInteger, message: 'Rating must be a whole number from 1 to 5' },
    },
    comment: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      minlength: [10, 'Review must be at least 10 characters'],
      maxlength: [1000, 'Review cannot exceed 1000 characters'],
    },
    // Published immediately; admins can hide a review (and publish it again)
    status: { type: String, enum: REVIEW_STATUSES, default: 'published' },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    moderatedAt: Date,
    moderationNote: { type: String, trim: true, maxlength: [300, 'Note cannot exceed 300 characters'] },
  },
  { timestamps: true }
);

// One review per customer per product (also stops two submissions racing each other)
reviewSchema.index({ product: 1, user: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 }); // product page list
reviewSchema.index({ status: 1, createdAt: -1 }); // admin list

// Recalculates Product.rating and Product.numReviews from the product's published reviews.
// Recalculating (rather than adding/subtracting) means the numbers can't drift and it is
// safe to run any number of times.
reviewSchema.statics.recalculateProductRating = async function (productId) {
  const [stats] = await this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), status: 'published' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await Product.updateOne(
    { _id: productId },
    { $set: { rating: stats ? Math.round(stats.average * 10) / 10 : 0, numReviews: stats?.count ?? 0 } }
  );
};

reviewSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Review = mongoose.model('Review', reviewSchema);
export default Review;
