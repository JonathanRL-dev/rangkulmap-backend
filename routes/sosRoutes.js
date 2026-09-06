const express = require('express');
const router = express.Router();

const {
  triggerSos,
  respondSos,
  updateVolunteerLocation,
  cancelSos,
  getSosStatus,
  ensureResponderAssigned,
} = require('../controllers/sosController');

const authMiddleware = require('../middlewares/authMiddleware');

// Tidak ada prefix di sini — prefix (/sos) di-tambahkan saat mounting di server.js
// Semua route di modul ini wajib login (authMiddleware)

// POST / -> trigger SOS baru
router.post('/', authMiddleware, triggerSos);

// POST /:id/respond -> responder (relawan yang ditugaskan) merespons SOS
// ensureResponderAssigned memastikan req.user.id ada di respondenDitugaskan sebelum lanjut
router.post('/:id/respond', authMiddleware, ensureResponderAssigned, respondSos);

// POST /:id/location -> relawan berstatus 'menuju' mengirim update lokasi realtime
router.post('/:id/location', authMiddleware, ensureResponderAssigned, updateVolunteerLocation);

// POST /:id/cancel -> pelapor membatalkan SOS event miliknya
router.post('/:id/cancel', authMiddleware, cancelSos);

// GET /:id -> detail SOS event (populate pelapor & respondenDitugaskan.user)
router.get('/:id', authMiddleware, getSosStatus);

module.exports = router;
