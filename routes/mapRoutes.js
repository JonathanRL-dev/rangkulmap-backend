const express = require('express');
const router = express.Router();

const { searchAddress, reverseGeocodeHandler } = require('../controllers/geocodeController');

const {
  getPointsInBounds,
  getCategories,
  reportNewPoint,
  confirmPoint,
  reportPointChanged,
} = require('../controllers/infrastrukturController');

const authMiddleware = require('../middlewares/authMiddleware');

// Tidak ada prefix di sini — prefix (/map) di-tambahkan saat mounting di server.js

// ===== GEOCODE (publik) =====

// GET /geocode/search?query= -> forward geocoding (alamat -> koordinat)
router.get('/geocode/search', searchAddress);

// GET /geocode/reverse?lat=&lng= -> reverse geocoding (koordinat -> alamat)
router.get('/geocode/reverse', reverseGeocodeHandler);

// ===== INFRASTRUKTUR =====

// GET /infrastructure/categories -> publik, daftar kategori statis
router.get('/infrastructure/categories', getCategories);

// GET /infrastructure/points?minLat=&maxLat=&minLng=&maxLng= -> publik, guest boleh lihat peta
router.get('/infrastructure/points', getPointsInBounds);

// POST /infrastructure/points/reports -> protected, lapor titik infrastruktur baru
router.post('/infrastructure/points/reports', authMiddleware, reportNewPoint);

// POST /infrastructure/points/:id/confirm -> protected, konfirmasi titik infrastruktur (atomic increment)
router.post('/infrastructure/points/:id/confirm', authMiddleware, confirmPoint);

// POST /infrastructure/points/:id/changed -> protected, lapor perubahan pada titik infrastruktur
router.post('/infrastructure/points/:id/changed', authMiddleware, reportPointChanged);

module.exports = router;
