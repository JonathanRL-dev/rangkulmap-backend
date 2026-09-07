const BantuanRequest = require('../models/BantuanRequest');
const User = require('../models/User');
const { applyXpGain } = require('../services/gamifikasiService');

const DEFAULT_VOLUNTEER_RADIUS_METERS = 5000; // 5 km, dipakai jika tidak ada override
const XP_REWARD_PER_COMPLETION = 50;
const TRUST_SCORE_REWARD_PER_COMPLETION = 5;

/**
 * GET /volunteers/nearby?lat=&lng=&radius=
 * Mencari User dengan role 'relawan' dan profilRelawan.status 'tersedia'
 * dalam radius tertentu (meter) dari koordinat yang diberikan.
 */
const getNearbyVolunteers = async (req, res, next) => {
  try {
    const { lat: latShort, lng: lngShort, latitude, longitude, radius } = req.query;
    const lat = latShort ?? latitude;
    const lng = lngShort ?? longitude;

    if (lat === undefined || lng === undefined) {
      const error = new Error('Parameter lat dan lng wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const maxDistance = radius ? parseInt(radius, 10) : DEFAULT_VOLUNTEER_RADIUS_METERS;

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      const error = new Error('Parameter lat dan lng harus berupa angka yang valid.');
      error.statusCode = 400;
      throw error;
    }

    if (Number.isNaN(maxDistance) || maxDistance <= 0) {
      const error = new Error('Parameter radius harus berupa angka positif (dalam meter).');
      error.statusCode = 400;
      throw error;
    }

    const volunteers = await User.find({
      role: 'relawan',
      'profilRelawan.status': 'tersedia',
      lokasi: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parsedLng, parsedLat],
          },
          $maxDistance: maxDistance,
        },
      },
    });

    return res.status(200).json(volunteers);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /requests
 * Membuat permintaan bantuan baru.
 * Body: { kategori, deskripsi, lokasi, alamat }
 * pemohon otomatis diisi dari req.user.id.
 */
const createBantuanRequest = async (req, res, next) => {
  try {
    const { kategori, deskripsi, lokasi, alamat, fotoUrls, prioritas } = req.body;

    const KATEGORI_ENUM = ['medis', 'logistik', 'evakuasi', 'psikologis', 'lainnya'];

    if (!kategori || !KATEGORI_ENUM.includes(kategori)) {
      const error = new Error(
        `Parameter kategori tidak valid. Harus salah satu dari: ${KATEGORI_ENUM.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }

    if (!deskripsi || deskripsi.trim() === '') {
      const error = new Error('Parameter deskripsi wajib diisi dan tidak boleh kosong.');
      error.statusCode = 400;
      throw error;
    }

    if (
      !lokasi ||
      lokasi.type !== 'Point' ||
      !Array.isArray(lokasi.coordinates) ||
      lokasi.coordinates.length !== 2
    ) {
      const error = new Error(
        'Parameter lokasi wajib berupa GeoJSON Point yang valid: { type: "Point", coordinates: [lng, lat] }.'
      );
      error.statusCode = 400;
      throw error;
    }

    const [lng, lat] = lokasi.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      const error = new Error('Koordinat lokasi (lng, lat) harus berupa angka.');
      error.statusCode = 400;
      throw error;
    }

    const newRequest = new BantuanRequest({
      pemohon: req.user.id,
      kategori,
      deskripsi: deskripsi.trim(),
      lokasi,
      alamat,
      fotoUrls,
      prioritas, // opsional, akan fallback ke default schema ('sedang') jika undefined
    });

    await newRequest.save();

    return res.status(201).json(newRequest);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /requests/incoming
 * Mengambil semua BantuanRequest berstatus 'menunggu' yang lokasinya dekat
 * dengan relawan yang sedang login. Radius diambil dari
 * profilRelawan.radiusJangkauanKm milik relawan (fallback ke default jika tidak ada).
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const volunteer = await User.findById(req.user.id);

    if (!volunteer) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (volunteer.role !== 'relawan') {
      const error = new Error('Hanya relawan yang dapat melihat permintaan bantuan masuk.');
      error.statusCode = 403;
      throw error;
    }

    const volunteerCoordinates = volunteer.lokasi && volunteer.lokasi.coordinates;

    if (
      !volunteerCoordinates ||
      volunteerCoordinates.length !== 2 ||
      (volunteerCoordinates[0] === 0 && volunteerCoordinates[1] === 0)
    ) {
      const error = new Error(
        'Lokasi relawan belum diatur. Perbarui lokasi terlebih dahulu untuk melihat permintaan terdekat.'
      );
      error.statusCode = 400;
      throw error;
    }

    const radiusKm =
      (volunteer.profilRelawan && volunteer.profilRelawan.radiusJangkauanKm) || 5;
    const maxDistanceMeters = radiusKm * 1000;

    const incomingRequests = await BantuanRequest.find({
      status: 'menunggu',
      lokasi: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: volunteerCoordinates,
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    });

    return res.status(200).json(incomingRequests);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /requests/:id/accept
 * Relawan menerima permintaan bantuan.
 * status -> 'diterima', relawanDitugaskan -> req.user.id
 * profilRelawan.status relawan diubah menjadi 'sedang_membantu'.
 */
const acceptRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bantuanRequest = await BantuanRequest.findById(id);

    if (!bantuanRequest) {
      const error = new Error('Permintaan bantuan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (bantuanRequest.status !== 'menunggu') {
      const error = new Error(
        `Permintaan bantuan tidak dapat diterima karena statusnya sudah '${bantuanRequest.status}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    bantuanRequest.status = 'diterima';
    bantuanRequest.relawanDitugaskan = req.user.id;
    await bantuanRequest.save();

    // Tandai relawan sedang menangani permintaan agar tidak muncul lagi di pencarian nearby
    await User.findByIdAndUpdate(req.user.id, {
      'profilRelawan.status': 'sedang_membantu',
    });

    return res.status(200).json(bantuanRequest);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /requests/:id/complete
 * Menyelesaikan permintaan bantuan.
 * status -> 'selesai', selesaiPada -> Date.now()
 * xp relawan +50, trustScore relawan +5 (atomic $inc)
 * profilRelawan.status relawan dikembalikan ke 'tersedia'
 */
const completeRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bantuanRequest = await BantuanRequest.findById(id);

    if (!bantuanRequest) {
      const error = new Error('Permintaan bantuan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (!bantuanRequest.relawanDitugaskan) {
      const error = new Error(
        'Permintaan bantuan belum memiliki relawan yang ditugaskan.'
      );
      error.statusCode = 409;
      throw error;
    }

    if (bantuanRequest.status !== 'diterima' && bantuanRequest.status !== 'dalam_perjalanan') {
      const error = new Error(
        `Permintaan bantuan tidak dapat diselesaikan karena statusnya '${bantuanRequest.status}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    bantuanRequest.status = 'selesai';
    bantuanRequest.selesaiPada = Date.now();
    await bantuanRequest.save();

    // Update atomik xp & trustScore relawan yang ditugaskan agar aman dari race condition
    await User.findByIdAndUpdate(bantuanRequest.relawanDitugaskan, {
      $inc: { trustScore: TRUST_SCORE_REWARD_PER_COMPLETION },
      $set: { 'profilRelawan.status': 'tersedia' },
    });
    await applyXpGain(bantuanRequest.relawanDitugaskan, XP_REWARD_PER_COMPLETION);

    return res.status(200).json(bantuanRequest);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /requests/:id/cancel
 * Membatalkan permintaan bantuan.
 * status -> 'dibatalkan'
 */
const cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const bantuanRequest = await BantuanRequest.findById(id);

    if (!bantuanRequest) {
      const error = new Error('Permintaan bantuan tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (bantuanRequest.status === 'selesai' || bantuanRequest.status === 'dibatalkan') {
      const error = new Error(
        `Permintaan bantuan tidak dapat dibatalkan karena statusnya sudah '${bantuanRequest.status}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    bantuanRequest.status = 'dibatalkan';
    await bantuanRequest.save();

    return res.status(200).json(bantuanRequest);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNearbyVolunteers,
  createBantuanRequest,
  getIncomingRequests,
  acceptRequest,
  completeRequest,
  cancelRequest,
};
