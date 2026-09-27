import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  app,
  Order,
  User,
  request,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  createProduct,
  validAddress,
} from './helpers.js';

before(startDatabase);
after(stopDatabase);
beforeEach(clearDatabase);

const getStats = (auth) => {
  const req = request(app).get('/api/admin/stats');
  return auth ? req.set('Authorization', auth) : req;
};

// Inserts an order with the given status directly (the order flow itself is covered in orders.test.js)
const insertOrder = (user, product, status) =>
  Order.create({
    user: user._id,
    items: [{ product: product._id, name: product.name, slug: product.slug, price: product.price, quantity: 1 }],
    shippingAddress: validAddress,
    itemsTotal: product.price,
    shippingFee: 49,
    totalAmount: product.price + 49,
    paymentMethod: 'cod',
    status,
  });

describe('GET /api/admin/stats', () => {
  test('requires login', async () => {
    const res = await getStats();
    assert.equal(res.status, 401);
  });

  test('regular users get 403', async () => {
    const customer = await createUser();
    const res = await getStats(customer.auth);
    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'You do not have permission to do this');
  });

  test('a user demoted from admin loses access immediately (role is read from the database)', async () => {
    const admin = await createUser({ role: 'admin' });
    assert.equal((await getStats(admin.auth)).status, 200);
    await User.updateOne({ _id: admin.user._id }, { role: 'user' });
    assert.equal((await getStats(admin.auth)).status, 403); // same token, now rejected
  });

  test('empty store -> all zeros', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await getStats(admin.auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.stats, {
      totalProducts: 0,
      totalOrders: 0,
      pendingOrders: 0,
      awaitingPayment: 0,
      lowStock: { threshold: 5, count: 0, products: [] },
    });
  });

  test('counts products, orders by status and low-stock products from real data', async () => {
    const admin = await createUser({ role: 'admin' });
    const customer = await createUser();

    const plenty = await createProduct({ name: 'Plenty', stock: 50 });
    await createProduct({ name: 'Six Left', stock: 6 }); // just above the threshold
    await createProduct({ name: 'Five Left', stock: 5 }); // at the threshold -> low
    await createProduct({ name: 'Sold Out', stock: 0 });
    await createProduct({ name: 'Two Left', stock: 2 });

    for (const status of ['confirmed', 'confirmed', 'awaiting_payment', 'shipped', 'delivered', 'cancelled']) {
      await insertOrder(customer.user, plenty, status);
    }

    const res = await getStats(admin.auth);
    assert.equal(res.status, 200);
    const { stats } = res.body;
    assert.equal(stats.totalProducts, 5);
    assert.equal(stats.totalOrders, 6);
    assert.equal(stats.pendingOrders, 2); // confirmed, not yet shipped
    assert.equal(stats.awaitingPayment, 1);
    assert.equal(stats.lowStock.count, 3);
    // Lowest stock first, only the fields the dashboard needs
    assert.deepEqual(
      stats.lowStock.products.map((p) => [p.name, p.stock]),
      [
        ['Sold Out', 0],
        ['Two Left', 2],
        ['Five Left', 5],
      ]
    );
    assert.equal(stats.lowStock.products[0].description, undefined);
    assert.ok(stats.lowStock.products[0].slug);
  });

  test('low-stock list is capped at 10 but the count is exact', async () => {
    const admin = await createUser({ role: 'admin' });
    for (let i = 0; i < 12; i++) await createProduct({ stock: i % 3 });
    const { stats } = (await getStats(admin.auth)).body;
    assert.equal(stats.lowStock.count, 12);
    assert.equal(stats.lowStock.products.length, 10);
  });
});
