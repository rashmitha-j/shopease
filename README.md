# ShopEase: MERN E-commerce Platform

A full-stack e-commerce app built with MongoDB, Express, React and Node.js.

> **Status:** Week 1 complete (backend setup + authentication). Week 2 complete (Products API, React client, product pages, login/register). Week 3 started: shopping cart done (in the browser), checkout next.

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
├── controllers/              Route logic (auth, users, products)
├── middleware/               protect, authorize, error handling
├── data/products.js          Sample catalogue for seeding
├── models/                   User (with addresses), Product
├── routes/                   Express routers
├── scripts/                  seedAdmin.js, seedProducts.js
├── utils/                    Token helpers, AppError, slug/regex helpers
├── app.js                    Express app (middleware + routes)
└── server.js                 Entry point: env check, DB connect, listen

client/
├── public/favicon.svg
├── src/
│   ├── api/                  fetch wrapper (token in memory, refresh + retry on 401), auth calls
│   ├── components/auth/      AuthCard
│   ├── components/cart/      AddToCart, CartLine, QuantityStepper
│   ├── components/layout/    Layout, responsive Navbar, Footer
│   ├── components/products/  ProductCard, ProductGrid, CategoryFilter, Pagination, StarRating
│   ├── components/ui/        Error and empty states, text/password fields
│   ├── context/              AuthProvider (current user, login, logout), CartProvider (cart state)
│   ├── hooks/                useApi (fetch data, cancel stale requests), useAuth, useCart
│   ├── pages/                Home, Products, ProductDetail, Cart, Login, Register, NotFound
│   ├── utils/                Cart logic, price formatting, pagination, form validation, safe redirects
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
