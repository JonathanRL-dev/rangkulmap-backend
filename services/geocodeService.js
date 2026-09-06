const axios = require('axios');

const LOCATIONIQ_BASE_URL = 'https://us1.locationiq.com/v1';

/**
 * Helper internal untuk membangun error dengan statusCode yang sesuai
 * berdasarkan response error dari LocationIQ, agar bisa ditangkap
 * oleh global error handler tanpa membuat server crash.
 */
const buildGeocodeError = (err, context) => {
  // Jika axios berhasil menghubungi server tapi server merespon error (4xx/5xx)
  if (err.response) {
    const status = err.response.status;
    let statusCode = 500;
    let message = `Terjadi kesalahan pada layanan geocoding (${context}).`;

    switch (status) {
      case 400:
        statusCode = 400;
        message = 'Permintaan geocoding tidak valid. Periksa kembali parameter yang dikirim.';
        break;
      case 401:
      case 403:
        statusCode = 500; // Kesalahan API key adalah masalah server, bukan client
        message = 'Konfigurasi layanan geocoding bermasalah. Hubungi administrator.';
        break;
      case 404:
        statusCode = 404;
        message = 'Lokasi/alamat tidak ditemukan.';
        break;
      case 429:
        statusCode = 429;
        message = 'Batas permintaan ke layanan geocoding tercapai. Silakan coba lagi nanti.';
        break;
      case 500:
      case 502:
      case 503:
        statusCode = 503;
        message = 'Layanan geocoding sedang tidak tersedia. Silakan coba lagi nanti.';
        break;
      default:
        statusCode = status >= 400 && status < 500 ? status : 500;
        break;
    }

    const error = new Error(message);
    error.statusCode = statusCode;
    error.originalError = err.response.data;
    return error;
  }

  // Jika request terkirim tapi tidak ada response (timeout, DNS error, dll)
  if (err.request) {
    const error = new Error(
      'Tidak dapat menghubungi layanan geocoding. Periksa koneksi jaringan server.'
    );
    error.statusCode = 503;
    return error;
  }

  // Error lain di luar dugaan (misal error saat setup request)
  const error = new Error(err.message || 'Terjadi kesalahan tak terduga pada layanan geocoding.');
  error.statusCode = 500;
  return error;
};

/**
 * Forward geocoding: mengubah alamat/nama tempat (string) menjadi koordinat.
 * @param {string} query - Alamat atau nama tempat yang dicari
 * @returns {Promise<Array>} Array hasil pencarian dari LocationIQ
 */
const forwardGeocode = async (query) => {
  try {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      const error = new Error('Parameter query wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const response = await axios.get(`${LOCATIONIQ_BASE_URL}/search.php`, {
      params: {
        key: process.env.LOCATIONIQ_SERVER_KEY,
        q: query,
        format: 'json',
        'accept-language': 'id',
        countrycodes: 'id',
        addressdetails: 1,
        normalizeaddress: 1,
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    // Jika sudah punya statusCode (error validasi di atas), lempar langsung
    if (err.statusCode) throw err;
    throw buildGeocodeError(err, 'forwardGeocode');
  }
};

/**
 * Reverse geocoding: mengubah koordinat (lat, lon) menjadi alamat.
 * @param {number|string} lat - Latitude
 * @param {number|string} lon - Longitude
 * @returns {Promise<Object>} Objek hasil reverse geocoding dari LocationIQ
 */
const reverseGeocode = async (lat, lon) => {
  try {
    if (lat === undefined || lat === null || lon === undefined || lon === null) {
      const error = new Error('Parameter lat dan lon wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const parsedLat = parseFloat(lat);
    const parsedLon = parseFloat(lon);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) {
      const error = new Error('Parameter lat dan lon harus berupa angka yang valid.');
      error.statusCode = 400;
      throw error;
    }

    const response = await axios.get(`${LOCATIONIQ_BASE_URL}/reverse.php`, {
      params: {
        key: process.env.LOCATIONIQ_SERVER_KEY,
        lat: parsedLat,
        lon: parsedLon,
        format: 'json',
        'accept-language': 'id',
        countrycodes: 'id',
        addressdetails: 1,
        normalizeaddress: 1,
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    if (err.statusCode) throw err;
    throw buildGeocodeError(err, 'reverseGeocode');
  }
};

module.exports = {
  forwardGeocode,
  reverseGeocode,
};
