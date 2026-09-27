import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request, startDatabase, stopDatabase } from './helpers.js';

// Each import with a different query string builds a separate Express app, so TRUST_PROXY
// (read when app.js loads) can be tested with different values. The routers, and so the
// rate limiters, are shared between these apps, so every test uses its own client IPs.
async function appWithTrustProxy(value) {
  const previous = process.env.TRUST_PROXY;
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  const { default: app } = await import(`../app.js?trustProxy=${value ?? 'default'}`);
  if (previous === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previous;
  return app;
}

// Login is rate limited to 20 attempts per 15 minutes per client IP
const LIMIT = 20;
const attemptLogin = (app, forwardedFor) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', forwardedFor).send({ email: 'nobody@test.com', password: 'wrongpass1' });

before(startDatabase);
after(stopDatabase);

describe('TRUST_PROXY', () => {
  test('defaults to 1 hop (Render only), the previous behaviour; invalid values fall back to 1', async () => {
    assert.equal((await appWithTrustProxy(undefined)).get('trust proxy'), 1);
    assert.equal((await appWithTrustProxy('2')).get('trust proxy'), 2);
    assert.equal((await appWithTrustProxy('abc')).get('trust proxy'), 1);
    assert.equal((await appWithTrustProxy('-3')).get('trust proxy'), 1);
  });

  test('2 hops (Vercel + Render): each visitor gets their own rate-limit bucket', async () => {
    const app = await appWithTrustProxy('2');
    const vercel = '203.0.113.20'; // the same Vercel IP forwards everyone's requests
    for (let i = 0; i < LIMIT; i++) assert.equal((await attemptLogin(app, `198.51.100.1, ${vercel}`)).status, 401);
    assert.equal((await attemptLogin(app, `198.51.100.1, ${vercel}`)).status, 429); // this visitor is limited
    assert.equal((await attemptLogin(app, `198.51.100.2, ${vercel}`)).status, 401); // another visitor is not
  });

  test('1 hop behind Vercel would wrongly put every visitor in the proxy’s bucket', async () => {
    const app = await appWithTrustProxy('1');
    const vercel = '203.0.113.10';
    for (let i = 0; i < LIMIT; i++) assert.equal((await attemptLogin(app, `198.51.100.${10 + i}, ${vercel}`)).status, 401);
    // A brand-new visitor is already limited: this is the problem TRUST_PROXY=2 fixes
    assert.equal((await attemptLogin(app, `198.51.100.99, ${vercel}`)).status, 429);
  });
});
