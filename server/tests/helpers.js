// Shared test setup: an in-memory MongoDB replica set (transactions need one),
// test env vars, and helpers to create users and products.
import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-secret';

const { default: app } = await import('../app.js');
const { default: User } = await import('../models/User.js');
const { default: Product } = await import('../models/Product.js');
const { default: Order } = await import('../models/Order.js');
const { signAccessToken } = await import('../utils/tokens.js');

export { app, User, Product, Order, request };

let replSet;

export async function startDatabase() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri());
  await Promise.all([User.init(), Product.init(), Order.init()]); // build unique indexes
}

export async function stopDatabase() {
  await mongoose.disconnect();
  await replSet?.stop();
}

export async function clearDatabase() {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
}

let userCount = 0;

// Creates a user and a real access token (signed like /api/auth/login does).
// Users are created directly rather than through /api/auth/register, whose rate
// limit (20 per 15 minutes) the test suite would exceed.
// Returns { user, token, auth } where `auth` is the Authorization header value.
export async function createUser({ role = 'user' } = {}) {
  userCount++;
  const user = await User.create({ name: `User ${userCount}`, email: `user${userCount}@test.com`, password: 'secret123', role });
  const token = signAccessToken(user);
  return { user: { ...user.toJSON(), _id: String(user._id) }, token, auth: `Bearer ${token}` };
}

export const createProduct = (overrides = {}) =>
  Product.create({
    name: `Product ${crypto.randomUUID().slice(0, 8)}`,
    description: 'A test product',
    brand: 'TestBrand',
    category: 'Electronics',
    price: 500,
    stock: 10,
    images: [{ url: 'https://example.com/p.jpg' }],
    ...overrides,
  });

export const stockOf = async (product) => (await Product.findById(product._id)).stock;

export const validAddress = {
  fullName: 'Rashmi J',
  phone: '+91 98765 43210',
  line1: '12 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
};

// Signs like Razorpay does after a successful payment
export const razorpaySignature = (orderId, paymentId) =>
  crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

// Stand-in for the Razorpay API; records calls and can be told to fail
export function fakeRazorpay() {
  const fake = {
    calls: [],
    fail: false,
    orders: {
      create: async (params) => {
        fake.calls.push(params);
        if (fake.fail) throw { statusCode: 500, error: { description: 'Razorpay is down' } };
        return { id: `order_test${fake.calls.length}`, amount: params.amount, currency: params.currency };
      },
    },
  };
  return fake;
}
