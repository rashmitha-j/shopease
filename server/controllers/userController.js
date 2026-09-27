import User from '../models/User.js';

// GET /api/users?page=1&limit=10   (admin only)
export const getUsers = async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

  const [users, total] = await Promise.all([
    User.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(),
  ]);

  res.json({
    success: true,
    users,
    page,
    pages: Math.ceil(total / limit),
    total,
  });
};
