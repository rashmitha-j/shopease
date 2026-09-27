import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  REFRESH_COOKIE,
  refreshCookieOptions,
} from '../utils/tokens.js';

// Issues a fresh access token + refresh token (rotation) and stores the
// refresh token's hash, so an old or stolen refresh token stops working.
const sendAuthResponse = async (res, user, statusCode) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  res.status(statusCode).json({ success: true, accessToken, user });
};

const clearRefreshCookie = (res) => {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
};

// POST /api/auth/register
export const register = async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    throw new AppError('Name, email and password are required', 400);
  }

  // role is never taken from the request body, so nobody can sign up as admin
  const user = await User.create({ name, email, password });
  await sendAuthResponse(res, user, 201);
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  // Same message for both cases so attackers can't tell which emails exist
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  await sendAuthResponse(res, user, 200);
};

// POST /api/auth/refresh  (uses the httpOnly cookie)
export const refresh = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw new AppError('No refresh token, please log in', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    clearRefreshCookie(res);
    throw new AppError('Session expired, please log in again', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || user.refreshTokenHash !== hashToken(token)) {
    // Token was already used or revoked: possible theft, so end the session
    if (user) {
      user.refreshTokenHash = undefined;
      await user.save({ validateBeforeSave: false });
    }
    clearRefreshCookie(res);
    throw new AppError('Session is no longer valid, please log in again', 401);
  }

  await sendAuthResponse(res, user, 200);
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await User.updateOne({ refreshTokenHash: hashToken(token) }, { $unset: { refreshTokenHash: 1 } });
  }
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logged out' });
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};
