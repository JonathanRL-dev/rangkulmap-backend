const { generateSignature } = require('../services/cloudinaryService');
const User = require('../models/User');

// Field yang diperbolehkan untuk disimpan lewat confirmVerificationUpload
const ALLOWED_TARGET_FIELDS = ['fotoKtpUrl', 'fotoSwafotoUrl', 'dokumenVerifikasiUrl'];

// Pemetaan role -> sub-profil & field verifikasi yang valid untuk role tersebut,
// sesuai schema profilRelawanSchema (fotoKtpUrl, fotoSwafotoUrl) dan
// profilMitraSchema (dokumenVerifikasiUrl) di models/User.js
const ROLE_VERIFICATION_MAP = {
  relawan: {
    subProfileKey: 'profilRelawan',
    allowedFields: ['fotoKtpUrl', 'fotoSwafotoUrl'],
  },
  mitra_profesional: {
    subProfileKey: 'profilMitra',
    allowedFields: ['dokumenVerifikasiUrl'],
  },
};

/**
 * GET /public-photo/config
 * Mengembalikan konfigurasi publik untuk unsigned upload
 * (dipakai untuk foto profil / foto infrastruktur). Tidak butuh auth.
 */
const getPublicUploadConfig = (req, res, next) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET_PUBLIC;

    if (!cloudName || !uploadPreset) {
      const error = new Error('Konfigurasi upload publik belum diatur di server.');
      error.statusCode = 500;
      throw error;
    }

    return res.status(200).json({
      cloudName,
      uploadPreset,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /verification/signature
 * Menghasilkan signature untuk signed upload dokumen verifikasi
 * (KTP, swafoto, dokumen mitra, dll). Wajib login (protected).
 * Body: { folder } -> opsional, default ke folder verifikasi berdasarkan user id
 */
const getVerificationSignature = (req, res, next) => {
  try {
    const { folder } = req.body;

    // Default folder unik per user agar dokumen verifikasi terorganisir & tidak bentrok
    const targetFolder = folder || `rangkulmap/verifikasi/${req.user.id}`;

    const signatureData = generateSignature(targetFolder);

    return res.status(200).json(signatureData);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /verification/confirm
 * Menyimpan publicId hasil upload signed ke field terkait pada sub-profil user
 * (profilRelawan atau profilMitra, tergantung role). Wajib login (protected).
 * Body: { publicId, targetField }
 */
const confirmVerificationUpload = async (req, res, next) => {
  try {
    const { publicId, targetField } = req.body;

    if (!publicId || typeof publicId !== 'string') {
      const error = new Error('Parameter publicId wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    if (!targetField || !ALLOWED_TARGET_FIELDS.includes(targetField)) {
      const error = new Error(
        `Parameter targetField tidak valid. Harus salah satu dari: ${ALLOWED_TARGET_FIELDS.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    // Tentukan sub-profil mana yang harus diupdate berdasarkan role user
    const roleConfig = ROLE_VERIFICATION_MAP[user.role];

    if (!roleConfig) {
      const error = new Error('Role user tidak mendukung upload dokumen verifikasi.');
      error.statusCode = 403;
      throw error;
    }

    const { subProfileKey, allowedFields } = roleConfig;

    // Pastikan targetField yang dikirim memang milik sub-profil role ini
    // (misal: relawan tidak boleh mengisi dokumenVerifikasiUrl milik mitra_profesional, dan sebaliknya)
    if (!allowedFields.includes(targetField)) {
      const error = new Error(
        `Field '${targetField}' tidak berlaku untuk role '${user.role}'. Field yang diizinkan: ${allowedFields.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!user[subProfileKey]) {
      const error = new Error(`Sub-profil (${subProfileKey}) belum tersedia untuk user ini.`);
      error.statusCode = 400;
      throw error;
    }

    // Simpan publicId ke field terkait di dalam sub-profil
    user[subProfileKey][targetField] = publicId;

    await user.save();

    return res.status(200).json({
      message: 'Dokumen verifikasi berhasil disimpan.',
      [subProfileKey]: user[subProfileKey],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPublicUploadConfig,
  getVerificationSignature,
  confirmVerificationUpload,
};
