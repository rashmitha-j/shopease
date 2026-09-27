// Replaces ALL products with the sample catalogue in data/products.js
// Run with: npm run seed:products   (run `npm run seed:admin` first)
import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import sampleProducts from '../data/products.js';

const { MONGO_URI, NODE_ENV } = process.env;

if (!MONGO_URI) {
  console.error('Set MONGO_URI in .env first.');
  process.exit(1);
}

// This deletes every product, so never run it against production by accident
if (NODE_ENV === 'production') {
  console.error('Refusing to seed products when NODE_ENV=production.');
  process.exit(1);
}

try {
  await mongoose.connect(MONGO_URI);

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) console.warn('No admin user found; products will have no createdBy. Run `npm run seed:admin` first.');

  const { deletedCount } = await Product.deleteMany({});
  await Review.deleteMany({}); // reviews of the removed products would be orphaned
  // create() (not insertMany) so the slug-generating save hooks run for each product
  const created = await Product.create(sampleProducts.map((p) => ({ ...p, createdBy: admin?._id })));

  console.log(`Removed ${deletedCount} existing product(s), added ${created.length} sample products.`);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
