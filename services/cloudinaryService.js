const cloudinary = require('cloudinary').v2;

// Konfigurasi Cloudinary dari environment variable
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Menghasilkan signature untuk signed upload ke Cloudinary dari sisi client (frontend).
 * Signature ini digunakan agar upload file (mis. foto profil, dokumentasi laporan)
 * bisa langsung dilakukan dari client tanpa membocorkan api_secret.
 *
 * @param {string} folder - Nama folder tujuan di Cloudinary (misal: 'rangkulmap/reports')
 * @returns {{ timestamp: number, signature: string, apiKey: string, cloudName: string }}
 */
const generateSignature = (folder) => {
  try {
    if (!folder || typeof folder !== 'string') {
      const error = new Error('Parameter folder wajib diisi dan harus berupa string.');
      error.statusCode = 400;
      throw error;
    }

    const timestamp = Math.round(new Date().getTime() / 1000);

    // Parameter yang akan ikut ditandatangani (signed).
    // Harus sama persis dengan parameter yang nanti dikirim client saat upload.
    const paramsToSign = {
      timestamp,
      folder,
      type: 'authenticated',
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
      err.message = err.message || 'Gagal membuat signature Cloudinary.';
    }
    throw err;
  }
};

module.exports = {
  generateSignature,
};
