// Points existing products at the images in data/products.js, matched by slug.
// Only the `images` field is written: no products are created or deleted, and
// ids, stock, prices, ratings and timestamps are left as they are.
// Run with: npm run update:images            (apply)
//           npm run update:images -- --dry-run   (show what would change)
import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import sampleProducts from '../data/products.js';
import { slugify } from '../utils/strings.js';

const { MONGO_URI } = process.env;
const dryRun = process.argv.includes('--dry-run');

if (!MONGO_URI) {
  console.error('Set MONGO_URI in .env first.');
  process.exit(1);
}

const sameImages = (a, b) => JSON.stringify(a.map((i) => i.url)) === JSON.stringify(b.map((i) => i.url));

try {
  await mongoose.connect(MONGO_URI);
  const counts = { updated: 0, unchanged: 0, missing: 0 };

  for (const sample of sampleProducts) {
    const slug = slugify(sample.name);
    const product = await Product.findOne({ slug }).select('images').lean();

    if (!product) {
      counts.missing++;
      console.log(`  missing    ${slug} (no product with this slug, skipped)`);
      continue;
    }
    if (sameImages(product.images, sample.images)) {
      counts.unchanged++;
      console.log(`  unchanged  ${slug}`);
      continue;
    }

    const from = product.images[0]?.url ?? '(none)';
    console.log(`  ${dryRun ? 'would set' : 'updated  '}  ${slug}: ${from} -> ${sample.images[0].url}`);
    if (!dryRun) {
      // timestamps: false so updatedAt is not bumped; only `images` changes
      await Product.updateOne({ _id: product._id }, { $set: { images: sample.images } }, { runValidators: true, timestamps: false });
    }
    counts.updated++;
  }

  const verb = dryRun ? 'would update' : 'updated';
  console.log(`\n${dryRun ? '[dry run] ' : ''}${verb} ${counts.updated}, unchanged ${counts.unchanged}, missing ${counts.missing}.`);
} catch (err) {
  console.error('Updating images failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
