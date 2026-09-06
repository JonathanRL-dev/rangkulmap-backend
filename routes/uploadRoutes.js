const express = require('express');
const router = express.Router();

const {
  getPublicUploadConfig,
  getVerificationSignature,
  confirmVerificationUpload,
} = require('../controllers/uploadController');

const authMiddleware = require('../middlewares/authMiddleware');

// Tidak ada prefix di sini — prefix (/uploads) di-tambahkan saat mounting di server.js

// GET /public-photo/config -> publik, dipakai untuk unsigned upload foto profil/infrastruktur
router.get('/public-photo/config', getPublicUploadConfig);

// POST /verification/signature -> protected, generate signature untuk signed upload dokumen verifikasi
router.post('/verification/signature', authMiddleware, getVerificationSignature);

// POST /verification/confirm -> protected, simpan publicId hasil upload ke sub-profil user
router.post('/verification/confirm', authMiddleware, confirmVerificationUpload);

module.exports = router;
