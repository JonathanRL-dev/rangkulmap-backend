const jwt = require('jsonwebtoken');

/**
 * Middleware opsional untuk memverifikasi JWT dari header Authorization: Bearer <token>
 * Jika valid, payload user akan disimpan di req.user; jika tidak, req.user bernilai null.
 */
const optionalAuthMiddleware = (req, res, next) => {
  req.user = null;

  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      return next();
    }

    jwt.verify(parts[1], process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next();
      }

      req.user = decoded;
      return next();
    });
  } catch (err) {
    return next();
  }
};

module.exports = optionalAuthMiddleware;
