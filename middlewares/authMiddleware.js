const jwt = require('jsonwebtoken');

/**
 * Middleware untuk memverifikasi JWT dari header Authorization: Bearer <token>
 * Jika valid, payload user akan disimpan di req.user
 * Jika tidak valid/tidak ada, error dengan statusCode 401 akan diteruskan ke next()
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;

    // Cek apakah header Authorization ada
    if (!authHeader) {
      const error = new Error('Akses ditolak. Token tidak ditemukan.');
      error.statusCode = 401;
      return next(error);
    }

    // Cek format header harus "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      const error = new Error('Format token tidak valid. Gunakan format: Bearer <token>');
      error.statusCode = 401;
      return next(error);
    }

    const token = parts[1];

    if (!token) {
      const error = new Error('Token tidak ditemukan.');
      error.statusCode = 401;
      return next(error);
    }

    // Verifikasi token menggunakan secret dari environment variable
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        let message = 'Token tidak valid.';

        if (err.name === 'TokenExpiredError') {
          message = 'Token telah kedaluwarsa. Silakan login kembali.';
        } else if (err.name === 'JsonWebTokenError') {
          message = 'Token tidak valid atau rusak.';
        }

        const error = new Error(message);
        error.statusCode = 401;
        return next(error);
      }

      // Simpan payload user ke req.user agar bisa diakses controller berikutnya
      req.user = decoded;
      next();
    });
  } catch (err) {
    // Fallback jika terjadi error tak terduga di luar proses verifikasi
    err.statusCode = err.statusCode || 401;
    next(err);
  }
};

module.exports = authMiddleware;
