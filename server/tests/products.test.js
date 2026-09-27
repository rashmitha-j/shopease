import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  app,
  Product,
  request,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  createProduct,
} from './helpers.js';

let admin;
let customer;

before(startDatabase);
after(stopDatabase);
beforeEach(async () => {
  await clearDatabase();
  admin = await createUser({ role: 'admin' });
  customer = await createUser();
});

const validBody = () => ({
  name: 'Mechanical Keyboard',
  description: 'Hot-swappable keyboard with brown switches.',
  brand: 'KeyCo',
  category: 'Electronics',
  price: 3499,
  mrp: 4999,
  stock: 12,
  images: [{ url: 'https://example.com/keyboard.jpg' }],
  isFeatured: true,
});

const withAuth = (req, auth) => (auth ? req.set('Authorization', auth) : req);
const create = (body, auth) => withAuth(request(app).post('/api/products').send(body), auth);
const update = (id, body, auth) => withAuth(request(app).patch(`/api/products/${id}`).send(body), auth);
const remove = (id, auth) => withAuth(request(app).delete(`/api/products/${id}`), auth);

describe('Admin-only product operations reject everyone else', () => {
  test('logged out -> 401 for create, update and delete; nothing changes', async () => {
    const p = await createProduct({ price: 100 });
    assert.equal((await create(validBody())).status, 401);
    assert.equal((await update(p._id, { price: 1 })).status, 401);
    assert.equal((await remove(p._id)).status, 401);
    assert.equal(await Product.countDocuments(), 1);
    assert.equal((await Product.findById(p._id)).price, 100);
  });

  test('customers -> 403 for create, update and delete; nothing changes', async () => {
    const p = await createProduct({ price: 100 });
    for (const res of [
      await create(validBody(), customer.auth),
      await update(p._id, { price: 1 }, customer.auth),
      await remove(p._id, customer.auth),
    ]) {
      assert.equal(res.status, 403);
      assert.equal(res.body.message, 'You do not have permission to do this');
    }
    assert.equal(await Product.countDocuments(), 1);
    assert.equal((await Product.findById(p._id)).price, 100);
  });

  test('an invalid token is rejected', async () => {
    const res = await create(validBody(), 'Bearer not-a-real-token');
    assert.equal(res.status, 401);
  });
});

describe('POST /api/products (admin)', () => {
  test('creates a product with a slug generated from the name', async () => {
    const res = await create(validBody(), admin.auth);
    assert.equal(res.status, 201, res.body.message);
    const { product } = res.body;
    assert.equal(product.slug, 'mechanical-keyboard');
    assert.equal(product.price, 3499);
    assert.equal(product.stock, 12);
    assert.equal(product.isFeatured, true);
    assert.equal(String(product.createdBy), admin.user._id);
  });

  test('a second product with the same name gets a unique slug', async () => {
    await create(validBody(), admin.auth);
    const res = await create(validBody(), admin.auth);
    assert.equal(res.status, 201);
    assert.match(res.body.product.slug, /^mechanical-keyboard-[0-9a-f]{6}$/);
  });

  test('server-managed fields cannot be set', async () => {
    const res = await create({ ...validBody(), slug: 'hacked', rating: 5, numReviews: 999, createdBy: customer.user._id }, admin.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.product.slug, 'mechanical-keyboard');
    assert.equal(res.body.product.rating, 0);
    assert.equal(res.body.product.numReviews, 0);
    assert.equal(String(res.body.product.createdBy), admin.user._id);
  });

  test('validation errors -> 400 with the model messages, nothing saved', async () => {
    const cases = [
      [{ name: '' }, /Name is required/],
      [{ brand: undefined }, /Brand is required/],
      [{ description: 'x'.repeat(2001) }, /Description cannot exceed 2000/],
      [{ category: 'Toys' }, /Category must be one of/],
      [{ price: -1, mrp: undefined }, /Price cannot be negative/],
      [{ mrp: 100 }, /MRP must be greater than or equal to price/],
      [{ stock: 2.5 }, /Stock must be a whole number/],
      [{ stock: -1 }, /Stock cannot be negative/],
      [{ images: [] }, /At least one image is required/],
    ];
    for (const [change, message] of cases) {
      const res = await create({ ...validBody(), ...change }, admin.auth);
      assert.equal(res.status, 400, `${JSON.stringify(change)} -> ${res.status}`);
      assert.match(res.body.message, message);
    }
    assert.equal(await Product.countDocuments(), 0);
  });
});

describe('PATCH /api/products/:id (admin)', () => {
  test('updates details and stock; the slug stays the same', async () => {
    const { body } = await create(validBody(), admin.auth);
    const res = await update(body.product._id, { name: 'Renamed Keyboard', price: 2999, stock: 0, isFeatured: false }, admin.auth);
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.product.name, 'Renamed Keyboard');
    assert.equal(res.body.product.price, 2999);
    assert.equal(res.body.product.stock, 0);
    assert.equal(res.body.product.isFeatured, false);
    assert.equal(res.body.product.slug, 'mechanical-keyboard'); // links keep working
  });

  test('MRP can be cleared with null', async () => {
    const { body } = await create(validBody(), admin.auth);
    const res = await update(body.product._id, { mrp: null }, admin.auth);
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.product.mrp, null);
  });

  test('cross-field validation runs on update (price above the stored MRP)', async () => {
    const { body } = await create(validBody(), admin.auth); // mrp 4999
    const res = await update(body.product._id, { price: 5000 }, admin.auth);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /MRP must be greater than or equal to price/);
    assert.equal((await Product.findById(body.product._id)).price, 3499);
  });

  test('no editable fields -> 400; unknown id -> 404; bad id -> 400', async () => {
    const { body } = await create(validBody(), admin.auth);
    assert.equal((await update(body.product._id, { rating: 5 }, admin.auth)).status, 400);
    assert.equal((await update('64b000000000000000000000', { price: 1 }, admin.auth)).status, 404);
    assert.equal((await update('not-an-id', { price: 1 }, admin.auth)).status, 400);
  });
});

describe('DELETE /api/products/:id (admin)', () => {
  test('deletes the product; deleting again -> 404', async () => {
    const { body } = await create(validBody(), admin.auth);
    const res = await remove(body.product._id, admin.auth);
    assert.equal(res.status, 200);
    assert.equal(await Product.countDocuments(), 0);
    assert.equal((await request(app).get('/api/products/mechanical-keyboard')).status, 404);
    assert.equal((await remove(body.product._id, admin.auth)).status, 404);
  });
});
