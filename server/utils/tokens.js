import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Short-lived token sent in the JSON body; the client keeps it in memory
// and sends it as `Authorization: Bearer <token>`.
export const signAccessToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m',
  });

// Long-lived token stored in an httpOnly cookie (JavaScript can't read it,
// which protects it from XSS). Used only to get a new access token.
// `jwtid` makes every refresh token unique, even two issued in the same second,
// so rotation always invalidates the previous one.
export const signRefreshToken = (user) =>
  jwt.sign({ id: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d',
    jwtid: crypto.randomUUID(),
  });

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const REFRESH_COOKIE = 'refreshToken';

export const refreshCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd, // HTTPS only in production
    sameSite: isProd ? 'none' : 'lax', // 'none' lets Vercel frontend + Render backend share it
    path: '/api/auth', // cookie is only sent to auth routes
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
};
