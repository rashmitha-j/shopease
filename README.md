# ShopEase: MERN E-commerce Platform

A full-stack e-commerce app built with MongoDB, Express, React and Node.js.

> **Status:** Week 1 complete (backend setup + authentication). Week 2 complete (Products API, React client, product pages, login/register). Week 3 complete: shopping cart, checkout with Razorpay or cash on delivery, and order history.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, React Router |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB Atlas |
| Auth | JWT access + refresh tokens, bcrypt, httpOnly cookies |
| Security | Helmet, CORS, rate limiting, refresh-token rotation |

## Getting started

### 1. Set up MongoDB Atlas (free)
1. Create an account at mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** → add a database user with a password.
3. **Network Access** → add IP address `0.0.0.0/0` (allow from anywhere) for development.
4. **Connect → Drivers** → copy the connection string.

### 2. Run the server
```bash
cd server
npm install
cp .env.example .env      # then paste your MONGO_URI and set the JWT secrets
npm run seed:admin        # creates the admin account from ADMIN_* in .env
npm run seed:products     # replaces all products with 20 sample products
npm run dev               # starts on http://localhost:5000
npm test                  # runs the API tests (see Testing below)
```

Generate strong JWT secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run the client
In a second terminal:
```bash
cd client
npm install
npm run dev               # starts on http://localhost:5173
```
In development Vite forwards every `/api` request to the server on port 5000, so no client `.env`
is needed. For a deployed build, copy `client/.env.example` to `client/.env` and set `VITE_API_URL`
to the server's URL.

Other client commands: `npm run build` (production build in `client/dist`), `npm run lint` (oxlint).

## API reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Create an account → returns `accessToken` + sets refresh cookie |
| POST | `/api/auth/login` | Public | Log in → returns `accessToken` + sets refresh cookie |
| POST | `/api/auth/refresh` | Refresh cookie | Get a new access token (rotates the refresh token) |
| POST | `/api/auth/logout` | Refresh cookie | Log out and revoke the refresh token |
| GET | `/api/auth/me` | Logged in | Current user's profile |
| GET | `/api/users?page=1&limit=10` | Admin | Paginated list of users |
| GET | `/api/products` | Public | Search, filter, sort and paginate products (see below) |
| GET | `/api/products/categories` | Public | Every category with its product count |
| GET | `/api/products/:slug` | Public | One product, e.g. `/api/products/true-wireless-earbuds` |
| POST | `/api/products` | Admin | Create a product |
| PATCH | `/api/products/:id` | Admin | Update some fields of a product |
| DELETE | `/api/products/:id` | Admin | Delete a product |
| POST | `/api/orders` | Logged in | Place an order (reserves stock; see below) |
| GET | `/api/orders/mine?page=1&limit=10` | Logged in | My orders, newest first |
| GET | `/api/orders/:id` | Owner or admin | One order |
| POST | `/api/orders/:id/verify-payment` | Owner | Confirm a Razorpay payment |
| POST | `/api/orders/:id/cancel` | Owner | Cancel an unpaid order and release its stock |
| POST | `/api/payments/razorpay/webhook` | Razorpay (signed) | Payment events from Razorpay (see below) |

Protected routes need the header `Authorization: Bearer <accessToken>`.

### Product search and filters
All query parameters for `GET /api/products` are optional and can be combined:

| Parameter | Example | Meaning |
|---|---|---|
| `q` | `q=earbuds` | Search in name and brand (case-insensitive, partial words match) |
| `category` | `category=Electronics` | One of Electronics, Fashion, Home, Books, Sports, Beauty |
| `brand` | `brand=sonic` | Exact brand (case-insensitive) |
| `minPrice`, `maxPrice` | `minPrice=500&maxPrice=2000` | Price range in INR |
| `minRating` | `minRating=4` | Rating of at least 0 to 5 |
| `inStock` | `inStock=true` | Only products with stock left |
| `sort` | `sort=price_asc` | `newest` (default), `price_asc`, `price_desc`, `rating` |
| `page`, `limit` | `page=2&limit=12` | Pagination (default 12 per page, max 100) |

Response: `{ success, products, page, pages, total }`.

Create/update body fields: `name`, `description`, `brand`, `category`, `price`, `mrp` (optional, must be ≥ price),
`images` (`[{ "url": "..." }]`, at least one), `stock`, `isFeatured`. The `slug` is generated from the name, and
`rating`/`numReviews` can't be set through the API.

### Orders and payments
`POST /api/orders` body:
```json
{
  "items": [{ "productId": "<id>", "quantity": 2 }],
  "shippingAddress": { "fullName": "Rashmi J", "phone": "9876543210", "line1": "12 MG Road",
                       "city": "Bengaluru", "state": "Karnataka", "postalCode": "560001" },
  "paymentMethod": "razorpay"
}
```
- **Prices come from the database**, never from the request. Shipping is free from ₹999, otherwise ₹49.
  Quantities are 1–10 per product.
- **Stock is reserved in a MongoDB transaction** when the order is placed: either every item is
  reserved or none is, and two customers can't both buy the last item.
- **Cash on delivery (`cod`)** orders are confirmed immediately.
- **Razorpay (`razorpay`)** orders start as `awaiting_payment`; the response includes
  `razorpay: { keyId, orderId, amount, currency }` for opening Razorpay Checkout. After paying, the
  client sends `razorpay_order_id`, `razorpay_payment_id` and `razorpay_signature` to
  `verify-payment`, which checks the HMAC-SHA256 signature with the key secret.
- Unpaid Razorpay orders are **cancelled after 30 minutes** by a background job and their stock is
  released. A payment that arrives after that is recorded (`paymentStatus: paid`, `status: cancelled`)
  so it can be refunded.
- **Checkout in the browser:** the checkout page loads Razorpay's `checkout.js` only when needed and
  opens the payment window with the server's Razorpay order. If the window is closed without paying,
  the order is cancelled at once so its stock is released (the window also times out after 15 minutes,
  inside the server's 30-minute limit). After a successful payment the order is never cancelled by the
  browser; if confirming it fails, the order page explains what happens next.
- Transactions need a replica set: MongoDB Atlas (including the free tier) works; a standalone local
  `mongod` does not, and placing orders would fail there.
- Razorpay keys are optional: set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (test mode keys from the
  Razorpay dashboard) to enable online payments. Without them only cash on delivery works.

### Razorpay webhook
If a customer pays but closes the tab before the browser reports the payment, the webhook still
confirms the order (otherwise the 30-minute expiry job would cancel a paid order).

- `POST /api/payments/razorpay/webhook` handles `payment.captured` and `order.paid` (both mean the money
  was captured). `payment.failed` is only logged; other events are acknowledged and ignored.
- The signature in `X-Razorpay-Signature` is checked against the **raw request body** with
  `RAZORPAY_WEBHOOK_SECRET` (timing-safe comparison), so this route is mounted before the JSON parser.
  Nothing in the payload is trusted before that check. The payment's amount and currency (INR) must
  also match the order.
- The browser's `verify-payment` call and the webhook use the same code
  (`server/services/payments.js`). Whichever arrives first confirms the order; the other, and any
  duplicate event, is a no-op. Paying never touches stock (it was reserved when the order was placed).
- Responses: `400` bad signature or payload, `503` secret not set, `200` handled or ignored (including
  unknown orders, so Razorpay stops retrying), `500` temporary failure (Razorpay retries).

**Setup:** in the Razorpay dashboard (test mode) go to *Account & Settings → Webhooks*, add
`https://<your-server>/api/payments/razorpay/webhook`, select `payment.captured`, `order.paid` and
`payment.failed`, and choose a secret. Put that secret in `RAZORPAY_WEBHOOK_SECRET` (it is different from
the key secret). Razorpay must be able to reach the URL, so use the deployed server, or a tunnel such as
ngrok when testing locally.

### Try it in Postman / Thunder Client
1. `POST http://localhost:5000/api/auth/register` with JSON body
   `{ "name": "Rashmi", "email": "rashmi@test.com", "password": "secret123" }`
2. Copy `accessToken` from the response.
3. `GET http://localhost:5000/api/auth/me` with header `Authorization: Bearer <token>`.

## How authentication works

1. **Login** returns a short-lived **access token** (15 min) in the response body and a
   long-lived **refresh token** (7 days) in an `httpOnly` cookie that JavaScript can't read.
2. The React app keeps the access token in memory and sends it with each request.
3. When it expires, the app calls `/api/auth/refresh`; the cookie is sent automatically and a
   new pair of tokens is issued.
4. **Rotation + reuse detection:** only a hash of the latest refresh token is stored. If an old
   refresh token is ever reused (a sign it was stolen), the whole session is revoked.
5. On page load the app calls `/api/auth/refresh` to restore the session, since the access token
   is lost on reload. Because of rotation, the client never sends two refreshes at once: parallel
   callers share a single request (`refreshSession` in `client/src/api/client.js`), otherwise the
   second one would look like reuse and end the session.

## Deployment (Render + Vercel)

- **Backend (Render):** root directory `server`, build `npm ci --omit=dev`, start `npm start`, health
  check `/api/health`. Set the variables from `server/.env.example` in Render (never commit them), with
  `NODE_ENV=production`, `CLIENT_URL=<your Vercel URL>` and `TRUST_PROXY=2`.
- **Frontend (Vercel):** root directory `client`, framework Vite (build `npm run build`, output `dist`).
  Leave `VITE_API_URL` empty. Before deploying, replace the placeholder in `client/vercel.json` with your
  Render URL.
- `client/vercel.json` forwards `/api/*` to Render, so the browser only talks to the Vercel domain and the
  refresh cookie is first-party (not blocked as a third-party cookie). Every other path falls back to
  `index.html`, so links such as `/products/...`, `/orders/...` and `/admin/...` work when opened directly.
- `TRUST_PROXY` is the number of proxies in front of Express: 1 = Render (default), 2 = Vercel + Render.
  With the wrong value, all visitors would share one rate-limit bucket (the proxy's IP).
- In the Razorpay Dashboard, point the webhook to `https://<render-url>/api/payments/razorpay/webhook`.

## Testing

`cd server && npm test` runs the API tests with Node's built-in test runner and `supertest`. They use
`mongodb-memory-server` (a temporary in-memory MongoDB replica set, downloaded on first run), so no
Atlas connection or `.env` is needed, and Razorpay is replaced by a fake client. They cover placing
orders, stock reservation and rollback, two buyers racing for the last item, payment signature
checks, cancelling, the 30-minute expiry, and who can see which orders.

## How the cart works

The backend has no cart API yet, so the cart is kept in the browser's `localStorage` (one cart per
browser, shared between logged-in and logged-out visits, and synced across open tabs). Each item
stores a copy of the product's price and stock, so when the cart page opens it re-fetches every
product and tells the user if a price changed, stock ran low, or a product was removed. Quantities
are limited to the available stock and at most 10 per item. Out-of-stock items stay in the cart
but are left out of the total.

## Security features
- Passwords hashed with bcrypt (12 salt rounds) and never returned by the API
- Users can't make themselves admin at signup; admins are created by a seed script
- Login and register are rate-limited (20 attempts per 15 minutes)
- Generic "invalid email or password" message so emails can't be enumerated
- Central error handler with clean JSON errors for validation, duplicates and bad tokens

## Project structure
```
server/
├── config/db.js              MongoDB connection
├── controllers/              Route logic (auth, users, products, orders)
├── middleware/               protect, authorize, error handling
├── data/products.js          Sample catalogue for seeding
├── jobs/                     Cancels unpaid online orders after 30 minutes
├── models/                   User (with addresses), Product, Order
├── routes/                   Express routers
├── scripts/                  seedAdmin.js, seedProducts.js
├── tests/                    API tests (node:test + supertest + in-memory MongoDB)
├── utils/                    Token helpers, AppError, slug/regex, pricing, Razorpay
├── app.js                    Express app (middleware + routes)
└── server.js                 Entry point: env check, DB connect, listen

client/
├── public/favicon.svg
├── src/
│   ├── api/                  fetch wrapper (token in memory, refresh + retry on 401), auth calls
│   ├── components/auth/      AuthCard, RequireAuth (redirects visitors to /login)
│   ├── components/checkout/  AddressForm
│   ├── components/orders/    OrderStatusBadge
│   ├── components/cart/      AddToCart, CartLine, QuantityStepper
│   ├── components/layout/    Layout, responsive Navbar, Footer
│   ├── components/products/  ProductCard, ProductGrid, CategoryFilter, Pagination, StarRating
│   ├── components/ui/        Error and empty states, text/password fields
│   ├── context/              AuthProvider (current user, login, logout), CartProvider (cart state)
│   ├── hooks/                useApi (fetch data, cancel stale requests), useAuth, useCart
│   ├── pages/                Home, Products, ProductDetail, Cart, Checkout, Orders, OrderDetail,
│   │                         Login, Register, NotFound
│   ├── utils/                Cart logic, order display helpers, Razorpay script loader, validation, …
│   ├── App.jsx               Routes (React Router)
│   ├── main.jsx              Entry point
│   └── index.css             Tailwind import + brand theme
├── index.html
└── vite.config.js            React + Tailwind plugins, /api proxy to the server
```

## Roadmap
- [x] Week 1: Server setup, authentication, role-based access
- [ ] Week 2: Products API (CRUD, search, filters, pagination), Cloudinary uploads, React product pages
- [ ] Week 3: Cart, checkout, Razorpay payments, orders
- [ ] Week 4: Admin dashboard, reviews, email notifications
- [ ] Week 5: Tests, UI polish, deployment
