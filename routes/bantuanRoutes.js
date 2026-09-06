const express = require('express');
const router = express.Router();

const {
  getNearbyVolunteers,
  createBantuanRequest,
  getIncomingRequests,
  acceptRequest,
  completeRequest,
  cancelRequest,
} = require('../controllers/bantuanController');

const authMiddleware = require('../middlewares/authMiddleware');

// Tidak ada prefix di sini — prefix (/bantuan) di-tambahkan saat mounting di server.js
// Semua route di modul ini wajib login (authMiddleware)

// GET /volunteers/nearby?lat=&lng=&radius= -> cari relawan tersedia terdekat
router.get('/volunteers/nearby', authMiddleware, getNearbyVolunteers);

// GET /requests/incoming -> permintaan bantuan masuk (status 'menunggu') dekat relawan yang login
router.get('/requests/incoming', authMiddleware, getIncomingRequests);

// POST /requests -> buat permintaan bantuan baru
router.post('/requests', authMiddleware, createBantuanRequest);

// POST /requests/:id/accept -> relawan menerima permintaan bantuan
router.post('/requests/:id/accept', authMiddleware, acceptRequest);

// POST /requests/:id/complete -> selesaikan permintaan bantuan
router.post('/requests/:id/complete', authMiddleware, completeRequest);

// POST /requests/:id/cancel -> batalkan permintaan bantuan
router.post('/requests/:id/cancel', authMiddleware, cancelRequest);

module.exports = router;
