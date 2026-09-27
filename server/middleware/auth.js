import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

// Requires a valid access token. Attaches the logged-in user to req.user.
export const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Not authorized, please log in', 401);
  }

  const token = header.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET); // throws if invalid/expired

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError('User no longer exists', 401);

  req.user = user;
  next();
};

// Use after `protect`: authorize('admin')
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new AppError('You do not have permission to do this', 403);
  }
  next();
};
