// Creates (or promotes) an admin account using ADMIN_* values from .env
// Run with: npm run seed:admin
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';

const { MONGO_URI, ADMIN_NAME = 'Admin', ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set MONGO_URI, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  process.exit(1);
}

try {
  await mongoose.connect(MONGO_URI);

  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (existing) {
    existing.role = 'admin';
    await existing.save({ validateBeforeSave: false });
    console.log(`Promoted existing user ${ADMIN_EMAIL} to admin.`);
  } else {
    await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin' });
    console.log(`Created admin account ${ADMIN_EMAIL}.`);
  }
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
