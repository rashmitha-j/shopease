# ShopEase: MERN E-commerce Platform

A full-stack e-commerce app built with MongoDB, Express, React and Node.js.

> **Status:** Week 1 complete (backend setup + authentication)

## Tech stack

| Layer | Tools |
|---|---|
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
npm run dev               # starts on http://localhost:5000
```

Generate strong JWT secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

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

Protected routes need the header `Authorization: Bearer <accessToken>`.

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
├── controllers/              Route logic (auth, users)
├── middleware/               protect, authorize, error handling
├── models/User.js            User schema with addresses
├── routes/                   Express routers
├── scripts/seedAdmin.js      Creates the admin account
├── utils/                    Token helpers, AppError
├── app.js                    Express app (middleware + routes)
└── server.js                 Entry point: env check, DB connect, listen
```

## Roadmap
- [x] Week 1: Server setup, authentication, role-based access
- [ ] Week 2: Products API (CRUD, search, filters, pagination), Cloudinary uploads, React product pages
- [ ] Week 3: Cart, checkout, Razorpay payments, orders
- [ ] Week 4: Admin dashboard, reviews, email notifications
- [ ] Week 5: Tests, UI polish, deployment
