const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getCurrentUser,
  updateUsername,
  updateLocation 
} = require('../controllers/authController');

const authMiddleware = require('../middlewares/authMiddleware');

// Tidak ada prefix di sini — prefix (/auth) di-tambahkan saat mounting di server.js

// POST /register -> registrasi user baru, langsung dapat token (tanpa OTP)
router.post('/register', register);

// POST /login -> login user, dapat token
router.post('/login', login);

// GET /me -> ambil data user yang sedang login (protected)
router.get('/me', authMiddleware, getCurrentUser);

// PATCH /me/username -> update username user yang sedang login (protected)
router.patch('/me/username', authMiddleware, updateUsername);
router.patch('/me/location', authMiddleware, updateLocation);

// POST /logout -> logout (stateless JWT: cukup instruksikan client menghapus token)
router.post('/logout', (req, res) => {
  return res.status(200).json({
    message: 'Logout berhasil. Silakan hapus token di sisi client.',
  });
});

module.exports = router;
