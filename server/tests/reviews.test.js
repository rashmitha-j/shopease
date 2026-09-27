import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  app,
  Order,
  Product,
  Review,
  request,
  startDatabase,
  stopDatabase,
  clearDatabase,
  createUser,
  createProduct,
  validAddress,
} from './helpers.js';

let admin;
let customer;
let product;

before(startDatabase);
after(stopDatabase);
beforeEach(async () => {
  await clearDatabase();
  admin = await createUser({ role: 'admin' });
  customer = await createUser();
  product = await createProduct({ name: 'Review Me', price: 500, stock: 50 });
});

const as = (req, auth) => (auth ? req.set('Authorization', auth) : req);
const post = (slug, body, auth) => as(request(app).post(`/api/products/${slug}/reviews`).send(body), auth);
const me = (slug, auth) => as(request(app).get(`/api/products/${slug}/reviews/me`), auth);
const list = (slug, query = '') => request(app).get(`/api/products/${slug}/reviews${query}`);
const edit = (id, body, auth) => as(request(app).patch(`/api/reviews/${id}`).send(body), auth);
const removeOwn = (id, auth) => as(request(app).delete(`/api/reviews/${id}`), auth);
const adminList = (query, auth) => as(request(app).get(`/api/admin/reviews${query}`), auth);
const moderate = (id, body, auth) => as(request(app).patch(`/api/admin/reviews/${id}`).send(body), auth);
const adminDelete = (id, auth) => as(request(app).delete(`/api/admin/reviews/${id}`), auth);

const good = (rating = 5) => ({ rating, comment: 'Really solid product, would buy again.' });

// An order for `p` in the given status (the order flow itself is tested in orders.test.js)
const insertOrder = (user, p, status = 'delivered') =>
  Order.create({
    user: user.user._id,
    items: [{ product: p._id, name: p.name, slug: p.slug, price: p.price, quantity: 1 }],
    shippingAddress: validAddress,
    itemsTotal: p.price,
    shippingFee: 49,
    totalAmount: p.price + 49,
    paymentMethod: 'cod',
    status,
  });

const productStats = async (p = product) => {
  const { rating, numReviews } = await Product.findById(p._id);
  return { rating, numReviews };
};

async function reviewAs(user, rating, p = product) {
  await insertOrder(user, p);
  const res = await post(p.slug, good(rating), user.auth);
  assert.equal(res.status, 201, res.body.message);
  return res.body.review;
}

describe('Authorization', () => {
  test('logged out: can read reviews, cannot create/edit/delete or check eligibility', async () => {
    const review = await reviewAs(customer, 4);
    assert.equal((await list(product.slug)).status, 200);
    assert.equal((await post(product.slug, good())).status, 401);
    assert.equal((await me(product.slug)).status, 401);
    assert.equal((await edit(review._id, { rating: 1 })).status, 401);
    assert.equal((await removeOwn(review._id)).status, 401);
  });

  test("customers can't edit or delete someone else's review (404) and can't use admin endpoints (403)", async () => {
    const review = await reviewAs(customer, 4);
    const other = await createUser();
    assert.equal((await edit(review._id, { rating: 1 }, other.auth)).status, 404);
    assert.equal((await removeOwn(review._id, other.auth)).status, 404);
    for (const res of [
      await adminList('', other.auth),
      await moderate(review._id, { status: 'hidden' }, other.auth),
      await adminDelete(review._id, other.auth),
    ]) {
      assert.equal(res.status, 403);
    }
    const saved = await Review.findById(review._id);
    assert.equal(saved.rating, 4);
    assert.equal(saved.status, 'published');
  });

  test('admin endpoints reject logged-out users', async () => {
    const review = await reviewAs(customer, 4);
    assert.equal((await adminList('')).status, 401);
    assert.equal((await moderate(review._id, { status: 'hidden' })).status, 401);
    assert.equal((await adminDelete(review._id)).status, 401);
  });
});

describe('Verified purchase (delivered orders only)', () => {
  test('no order, or an order that is not delivered -> 403 and not eligible', async () => {
    assert.equal((await post(product.slug, good(), customer.auth)).status, 403);
    for (const status of ['awaiting_payment', 'confirmed', 'shipped', 'cancelled']) {
      await Order.deleteMany({});
      await insertOrder(customer, product, status);
      const res = await post(product.slug, good(), customer.auth);
      assert.equal(res.status, 403, status);
      assert.match(res.body.message, /received this product/);
      assert.deepEqual({ ...(await me(product.slug, customer.auth)).body, success: undefined }, {
        success: undefined,
        canReview: false,
        reason: 'not_purchased',
        myReview: null,
      });
    }
    assert.equal(await Review.countDocuments(), 0);
  });

  test("someone else's delivered order doesn't count; a delivered order of another product doesn't count", async () => {
    const other = await createUser();
    await insertOrder(other, product);
    const otherProduct = await createProduct();
    await insertOrder(customer, otherProduct);
    assert.equal((await post(product.slug, good(), customer.auth)).status, 403);
  });

  test('delivered order -> eligible, review created and linked to that order', async () => {
    const order = await insertOrder(customer, product);
    const status = await me(product.slug, customer.auth);
    assert.equal(status.body.canReview, true);

    const res = await post(product.slug, good(4), customer.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.review.rating, 4);
    assert.equal(res.body.review.status, 'published');
    assert.equal(String(res.body.review.order), String(order._id));
  });

  test('works end to end with the real order flow (place COD order, admin ships and delivers)', async () => {
    const placed = await request(app)
      .post('/api/orders')
      .set('Authorization', customer.auth)
      .send({ items: [{ productId: product._id, quantity: 1 }], shippingAddress: validAddress, paymentMethod: 'cod' });
    assert.equal(placed.status, 201);
    assert.equal((await post(product.slug, good(), customer.auth)).status, 403); // confirmed, not delivered

    for (const status of ['shipped', 'delivered']) {
      const res = await request(app).patch(`/api/admin/orders/${placed.body.order._id}/status`).set('Authorization', admin.auth).send({ status });
      assert.equal(res.status, 200);
    }
    assert.equal((await post(product.slug, good(), customer.auth)).status, 201);
  });

  test('unknown product -> 404', async () => {
    assert.equal((await post('no-such-product', good(), customer.auth)).status, 404);
    assert.equal((await list('no-such-product')).status, 404);
  });
});

describe('Validation and protected fields', () => {
  test('rating must be a whole number 1-5 and comment 10-1000 characters', async () => {
    await insertOrder(customer, product);
    const cases = [
      [{ comment: good().comment }, /Rating is required/],
      [{ ...good(), rating: 0 }, /between 1 and 5/],
      [{ ...good(), rating: 6 }, /between 1 and 5/],
      [{ ...good(), rating: 3.5 }, /whole number/],
      [{ rating: 5 }, /Review text is required/],
      [{ rating: 5, comment: '   short   ' }, /at least 10 characters/],
      [{ rating: 5, comment: 'x'.repeat(1001) }, /cannot exceed 1000/],
    ];
    for (const [body, message] of cases) {
      const res = await post(product.slug, body, customer.auth);
      assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
      assert.match(res.body.message, message);
    }
    assert.equal(await Review.countDocuments(), 0);
  });

  test("customers can't set status, user, product or order", async () => {
    const order = await insertOrder(customer, product);
    const other = await createUser();
    const res = await post(product.slug, { ...good(), status: 'hidden', user: other.user._id, product: 'x', order: 'y' }, customer.auth);
    assert.equal(res.status, 201);
    assert.equal(res.body.review.status, 'published');
    assert.equal(String(res.body.review.user), customer.user._id);
    assert.equal(String(res.body.review.product), String(product._id));
    assert.equal(String(res.body.review.order), String(order._id));

    const hideAttempt = await edit(res.body.review._id, { status: 'hidden', rating: 2 }, customer.auth);
    assert.equal(hideAttempt.body.review.status, 'published');
    assert.equal(hideAttempt.body.review.rating, 2);
  });
});

describe('Duplicates', () => {
  test('a second review for the same product -> 409 (even after another delivered order)', async () => {
    await reviewAs(customer, 5);
    await insertOrder(customer, product);
    const res = await post(product.slug, good(1), customer.auth);
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already reviewed/);
    assert.equal((await me(product.slug, customer.auth)).body.reason, 'already_reviewed');
    assert.equal(await Review.countDocuments(), 1);
  });

  test('two submissions at the same moment: exactly one is saved', async () => {
    await insertOrder(customer, product);
    const results = await Promise.all(Array.from({ length: 5 }, () => post(product.slug, good(), customer.auth)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409]);
    for (const r of results.filter((x) => x.status === 409)) assert.match(r.body.message, /already reviewed/);
    assert.equal(await Review.countDocuments(), 1);
    assert.deepEqual(await productStats(), { rating: 5, numReviews: 1 });
  });

  test('the same customer can review different products', async () => {
    await reviewAs(customer, 5);
    const second = await createProduct();
    await reviewAs(customer, 3, second);
    assert.equal(await Review.countDocuments(), 2);
  });
});

describe('Product rating and numReviews stay consistent', () => {
  test('create, edit, delete, hide and unhide all recalculate from published reviews', async () => {
    const [a, b, c] = [customer, await createUser(), await createUser()];
    const ra = await reviewAs(a, 5);
    assert.deepEqual(await productStats(), { rating: 5, numReviews: 1 });
    const rb = await reviewAs(b, 4);
    await reviewAs(c, 2);
    assert.deepEqual(await productStats(), { rating: 3.7, numReviews: 3 }); // 11/3 = 3.67

    await edit(rb._id, { rating: 1 }, b.auth); // 5 + 1 + 2 = 8/3
    assert.deepEqual(await productStats(), { rating: 2.7, numReviews: 3 });

    await moderate(ra._id, { status: 'hidden', note: 'Spam' }, admin.auth); // 1 + 2
    assert.deepEqual(await productStats(), { rating: 1.5, numReviews: 2 });

    await edit(ra._id, { rating: 3 }, a.auth); // editing a hidden review keeps it hidden
    assert.equal((await Review.findById(ra._id)).status, 'hidden');
    assert.deepEqual(await productStats(), { rating: 1.5, numReviews: 2 });

    await moderate(ra._id, { status: 'published' }, admin.auth); // 3 + 1 + 2
    assert.deepEqual(await productStats(), { rating: 2, numReviews: 3 });

    await removeOwn(rb._id, b.auth); // 3 + 2
    assert.deepEqual(await productStats(), { rating: 2.5, numReviews: 2 });

    const rc = await Review.findOne({ user: c.user._id });
    await adminDelete(rc._id, admin.auth);
    await adminDelete(ra._id, admin.auth);
    assert.deepEqual(await productStats(), { rating: 0, numReviews: 0 });
  });

  test("other products' ratings are not affected", async () => {
    const second = await createProduct();
    await reviewAs(customer, 1, second);
    await reviewAs(customer, 5);
    assert.deepEqual(await productStats(second), { rating: 1, numReviews: 1 });
    assert.deepEqual(await productStats(), { rating: 5, numReviews: 1 });
  });

  test('the storefront sort and filter by rating now use real ratings', async () => {
    const other = await createProduct({ name: 'Other Thing' });
    await reviewAs(customer, 2, other);
    await reviewAs(customer, 5);
    const sorted = await request(app).get('/api/products?sort=rating');
    assert.equal(sorted.body.products[0].name, 'Review Me');
    const filtered = await request(app).get('/api/products?minRating=4');
    assert.deepEqual(filtered.body.products.map((p) => p.name), ['Review Me']);
  });
});

describe('Public list and summary', () => {
  test('only published reviews, with reviewer name only, distribution, sorting and pagination', async () => {
    const users = [customer, await createUser(), await createUser(), await createUser()];
    const ratings = [5, 3, 4, 1];
    const reviews = [];
    for (let i = 0; i < users.length; i++) reviews.push(await reviewAs(users[i], ratings[i]));
    await moderate(reviews[3]._id, { status: 'hidden', note: 'Abusive' }, admin.auth);

    const res = await list(product.slug);
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 3);
    assert.deepEqual(res.body.summary, { average: 4, count: 3, distribution: { 5: 1, 4: 1, 3: 1, 2: 0, 1: 0 } });
    const [first] = res.body.reviews;
    assert.ok(first.user.name);
    assert.equal(first.user.email, undefined); // no personal data
    assert.equal(first.status, undefined);
    assert.equal(first.moderationNote, undefined);

    assert.deepEqual((await list(product.slug, '?sort=highest')).body.reviews.map((r) => r.rating), [5, 4, 3]);
    assert.deepEqual((await list(product.slug, '?sort=lowest')).body.reviews.map((r) => r.rating), [3, 4, 5]);
    const page2 = await list(product.slug, '?limit=2&page=2');
    assert.equal(page2.body.reviews.length, 1);
    assert.equal(page2.body.pages, 2);
    assert.equal((await list(product.slug, '?sort=random')).status, 400);
  });

  test('the author still sees their hidden review through /me, with the moderation note', async () => {
    const review = await reviewAs(customer, 5);
    await moderate(review._id, { status: 'hidden', note: 'Contains a phone number' }, admin.auth);
    const res = await me(product.slug, customer.auth);
    assert.equal(res.body.reason, 'already_reviewed');
    assert.equal(res.body.myReview.status, 'hidden');
    assert.equal(res.body.myReview.moderationNote, 'Contains a phone number');
    assert.equal(res.body.myReview.moderatedBy, undefined);
  });
});

describe('Customer managing their own review', () => {
  test('edit and delete own review; bad input and bad ids handled', async () => {
    const review = await reviewAs(customer, 5);
    const res = await edit(review._id, { rating: 4, comment: 'Updated: still good but pricey.' }, customer.auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.review.rating, 4);
    assert.equal((await edit(review._id, { rating: 9 }, customer.auth)).status, 400);
    assert.equal((await edit(review._id, {}, customer.auth)).status, 400);
    assert.equal((await edit('not-an-id', { rating: 3 }, customer.auth)).status, 400);

    assert.equal((await removeOwn(review._id, customer.auth)).status, 200);
    assert.equal((await removeOwn(review._id, customer.auth)).status, 404);
    // After deleting, the customer can review again (they still have a delivered order)
    assert.equal((await me(product.slug, customer.auth)).body.canReview, true);
  });
});

describe('Admin moderation', () => {
  test('list with product and customer, filters and search', async () => {
    const b = await createUser();
    const r1 = await reviewAs(customer, 5);
    await reviewAs(b, 2);
    await moderate(r1._id, { status: 'hidden' }, admin.auth);

    const all = await adminList('', admin.auth);
    assert.equal(all.status, 200);
    assert.equal(all.body.total, 2);
    assert.equal(all.body.reviews[0].product.name, 'Review Me');
    assert.ok(all.body.reviews[0].user.email);

    assert.equal((await adminList('?status=hidden', admin.auth)).body.total, 1);
    assert.equal((await adminList('?rating=2', admin.auth)).body.total, 1);
    assert.equal((await adminList(`?q=${encodeURIComponent(b.user.email)}`, admin.auth)).body.total, 1);
    assert.equal((await adminList('?q=review%20me', admin.auth)).body.total, 2); // product name
    assert.equal((await adminList('?q=would%20buy', admin.auth)).body.total, 2); // comment text
    for (const q of ['?status=deleted', '?rating=6', '?rating=abc']) {
      assert.equal((await adminList(q, admin.auth)).status, 400, q);
    }
  });

  test('hide records who/when/why; unhide clears the note; bad input rejected', async () => {
    const review = await reviewAs(customer, 5);
    const hidden = await moderate(review._id, { status: 'hidden', note: '  Off-topic  ' }, admin.auth);
    assert.equal(hidden.status, 200);
    assert.equal(hidden.body.review.status, 'hidden');
    assert.equal(hidden.body.review.moderationNote, 'Off-topic');
    assert.equal(String(hidden.body.review.moderatedBy), admin.user._id);
    assert.ok(hidden.body.review.moderatedAt);

    const shown = await moderate(review._id, { status: 'published' }, admin.auth);
    assert.equal(shown.body.review.status, 'published');
    assert.equal(shown.body.review.moderationNote, undefined);

    assert.equal((await moderate(review._id, { status: 'deleted' }, admin.auth)).status, 400);
    assert.equal((await moderate('64b000000000000000000000', { status: 'hidden' }, admin.auth)).status, 404);
    assert.equal((await adminDelete('64b000000000000000000000', admin.auth)).status, 404);
  });
});

describe('Product deletion cleanup', () => {
  test('deleting a product deletes its reviews only', async () => {
    const keep = await createProduct();
    await reviewAs(customer, 5);
    await reviewAs(customer, 4, keep);
    const res = await request(app).delete(`/api/products/${product._id}`).set('Authorization', admin.auth);
    assert.equal(res.status, 200);
    assert.equal(await Review.countDocuments({ product: product._id }), 0);
    assert.equal(await Review.countDocuments({ product: keep._id }), 1);
  });
});
