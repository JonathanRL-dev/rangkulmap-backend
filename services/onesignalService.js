const axios = require('axios');

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

/**
 * Helper internal untuk memetakan error dari OneSignal API ke statusCode yang sesuai,
 * agar bisa ditangkap oleh global error handler tanpa membuat server crash.
 */
const buildOneSignalError = (err) => {
  if (err.response) {
    const status = err.response.status;
    let statusCode = 500;
    let message = 'Terjadi kesalahan pada layanan push notification.';

    switch (status) {
      case 400:
        statusCode = 400;
        message = 'Permintaan push notification tidak valid.';
        break;
      case 401:
      case 403:
        statusCode = 500; // masalah konfigurasi API key adalah tanggung jawab server
        message = 'Konfigurasi layanan push notification bermasalah. Hubungi administrator.';
        break;
      case 429:
        statusCode = 429;
        message = 'Batas permintaan ke layanan push notification tercapai. Silakan coba lagi nanti.';
        break;
      case 500:
      case 502:
      case 503:
        statusCode = 503;
        message = 'Layanan push notification sedang tidak tersedia.';
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

  if (err.request) {
    const error = new Error(
      'Tidak dapat menghubungi layanan push notification. Periksa koneksi jaringan server.'
    );
    error.statusCode = 503;
    return error;
  }

  const error = new Error(err.message || 'Terjadi kesalahan tak terduga pada layanan push notification.');
  error.statusCode = 500;
  return error;
};

/**
 * Mengirim push notification ke satu atau beberapa user berdasarkan accountId (external_id).
 *
 * PENTING: Pakai `include_aliases: { external_id: [...] }`, BUKAN player_ids/include_player_ids.
 * `target_channel: 'push'` wajib disertakan saat memakai include_aliases (OneSignal REST API v1).
 *
 * @param {string[]|string} targetAccountIds - Satu atau beberapa accountId user tujuan
 * @param {string} heading - Judul notifikasi
 * @param {string} content - Isi/body notifikasi
 * @param {Object} [customData] - Data tambahan (opsional) yang dikirim bersama notifikasi,
 *                                 misal { sosId, type: 'sos_baru' } untuk dipakai deep-link di frontend
 * @returns {Promise<Object>} Response dari OneSignal API
 */
const sendPushNotification = async (targetAccountIds, heading, content, customData = {}) => {
  try {
    if (!targetAccountIds || (Array.isArray(targetAccountIds) && targetAccountIds.length === 0)) {
      const error = new Error('Parameter targetAccountIds wajib diisi (minimal 1 accountId).');
      error.statusCode = 400;
      throw error;
    }

    if (!heading || !content) {
      const error = new Error('Parameter heading dan content wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      const error = new Error('Konfigurasi OneSignal (APP_ID/REST_API_KEY) belum diatur di server.');
      error.statusCode = 500;
      throw error;
    }

    // Normalisasi jadi array, karena include_aliases.external_id selalu berupa array
    const accountIdList = Array.isArray(targetAccountIds) ? targetAccountIds : [targetAccountIds];

    const payload = {
      app_id: process.env.ONESIGNAL_APP_ID,
      include_aliases: {
        external_id: accountIdList,
      },
      target_channel: 'push',
      headings: { en: heading },
      contents: { en: content },
      data: customData,
    };

    const response = await axios.post(ONESIGNAL_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      timeout: 10000,
    });

    return response.data;
  } catch (err) {
    if (err.statusCode) throw err;
    throw buildOneSignalError(err);
  }
};

module.exports = {
  sendPushNotification,
};
