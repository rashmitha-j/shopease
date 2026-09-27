import mongoose from 'mongoose';
import { slugify, randomSuffix } from '../utils/strings.js';

export const CATEGORIES = ['Electronics', 'Fashion', 'Home', 'Books', 'Sports', 'Beauty'];

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: [true, 'Image URL is required'], trim: true },
    // Cloudinary public_id, so the image can be deleted later (empty for external URLs)
    publicId: { type: String, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    // URL-friendly id, e.g. /products/wireless-earbuds. Set once and kept stable.
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
      maxlength: [50, 'Brand cannot exceed 50 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: { values: CATEGORIES, message: `Category must be one of: ${CATEGORIES.join(', ')}` },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // Original price, shown struck through with a "% off" badge
    mrp: {
      type: Number,
      min: [0, 'MRP cannot be negative'],
      validate: {
        validator(value) {
          return value == null || value >= this.price;
        },
        message: 'MRP must be greater than or equal to price',
      },
    },
    images: {
      type: [imageSchema],
      validate: {
        validator: (images) => images.length > 0,
        message: 'At least one image is required',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Stock is required'],
      min: [0, 'Stock cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number' },
    },
    // Maintained by the reviews feature, never set directly through the API
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0, min: 0 },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Supports the most common listing query: filter by category, sort/filter by price
productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });

// Slugs that would clash with fixed routes like GET /api/products/categories
const RESERVED_SLUGS = ['categories'];

// Generate a unique slug from the name when the product is first created
productSchema.pre('validate', async function () {
  if (this.slug || !this.name) return;

  const base = slugify(this.name) || 'product';
  const taken = RESERVED_SLUGS.includes(base) || (await this.constructor.exists({ slug: base }));
  this.slug = taken ? `${base}-${randomSuffix()}` : base;
});

productSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Product = mongoose.model('Product', productSchema);
export default Product;
