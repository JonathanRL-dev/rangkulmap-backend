const InfrastrukturPoint = require('../models/InfrastrukturPoint');

// Daftar kategori statis, harus sinkron dengan enum `kategori` di schema InfrastrukturPoint.js
const KATEGORI_LIST = [
  'rumah_sakit',
  'posko_bencana',
  'sumber_air',
  'tempat_ibadah',
  'jalur_evakuasi',
  'lainnya',
];

// Ambang batas jumlah konfirmasi agar titik dianggap "verified" (hanya untuk response, tidak disimpan ke DB)
const VERIFIED_THRESHOLD = 3;

/**
 * GET /infrastructure/points?minLat=&maxLat=&minLng=&maxLng=
 * Mengambil titik infrastruktur dalam suatu bounding box (viewport peta).
 *
 * PENTING: field `lokasi` menggunakan index 2dsphere (GeoJSON), sehingga operator
 * $box (yang hanya didukung index 2d) TIDAK bisa dipakai. Solusinya: bentuk polygon
 * dari 4 titik sudut bounding box lalu query dengan $geoWithin + $geometry.
 */
const getPointsInBounds = async (req, res, next) => {
  try {
    const { minLat, maxLat, minLng, maxLng } = req.query;

    if (
      minLat === undefined ||
      maxLat === undefined ||
      minLng === undefined ||
      maxLng === undefined
    ) {
      const error = new Error('Parameter minLat, maxLat, minLng, dan maxLng wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const parsedMinLat = parseFloat(minLat);
    const parsedMaxLat = parseFloat(maxLat);
    const parsedMinLng = parseFloat(minLng);
    const parsedMaxLng = parseFloat(maxLng);

    if (
      [parsedMinLat, parsedMaxLat, parsedMinLng, parsedMaxLng].some((val) => Number.isNaN(val))
    ) {
      const error = new Error('Parameter minLat, maxLat, minLng, dan maxLng harus berupa angka.');
      error.statusCode = 400;
      throw error;
    }

    if (parsedMinLat >= parsedMaxLat || parsedMinLng >= parsedMaxLng) {
      const error = new Error(
        'Nilai minLat/minLng harus lebih kecil dari maxLat/maxLng.'
      );
      error.statusCode = 400;
      throw error;
    }

    // Bangun polygon tertutup (titik awal = titik akhir) dari 4 sudut bounding box
    const polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [parsedMinLng, parsedMinLat],
          [parsedMaxLng, parsedMinLat],
          [parsedMaxLng, parsedMaxLat],
          [parsedMinLng, parsedMaxLat],
          [parsedMinLng, parsedMinLat],
        ],
      ],
    };

    const points = await InfrastrukturPoint.find({
      lokasi: {
        $geoWithin: {
          $geometry: polygon,
        },
      },
    });

    // Tambahkan field virtual `verified` di response TANPA menyimpannya ke DB
    const formattedPoints = points.map((point) => {
      const pointObj = point.toObject();
      pointObj.verified = (point.jumlahKonfirmasi || 0) >= VERIFIED_THRESHOLD;
      return pointObj;
    });

    return res.status(200).json(formattedPoints);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /infrastructure/categories
 * Mengembalikan daftar kategori statis sesuai enum `kategori` di schema.
 */
const getCategories = (req, res, next) => {
  try {
    return res.status(200).json(KATEGORI_LIST);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /infrastructure/points/reports
 * Melaporkan titik infrastruktur baru.
 * Body: { namaTempat, kategori, deskripsi, alamat, fotoUrl, lokasi }
 * `lokasi` harus berupa GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }
 */
const reportNewPoint = async (req, res, next) => {
  try {
    const { namaTempat, kategori, deskripsi, alamat, fotoUrl, lokasi } = req.body;

    if (!namaTempat || namaTempat.trim() === '') {
      const error = new Error('Parameter namaTempat wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    if (!kategori || !KATEGORI_LIST.includes(kategori)) {
      const error = new Error(
        `Parameter kategori tidak valid. Harus salah satu dari: ${KATEGORI_LIST.join(', ')}.`
      );
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

    const newPoint = new InfrastrukturPoint({
      namaTempat,
      kategori,
      deskripsi,
      alamat,
      fotoUrl,
      lokasi,
      jumlahKonfirmasi: 0,
      ditambahkanOleh: req.user ? req.user.id : undefined,
    });

    await newPoint.save();

    const pointObj = newPoint.toObject();
    pointObj.verified = false; // titik baru pasti belum verified

    return res.status(201).json(pointObj);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /infrastructure/points/:id/confirm
 * Menambah jumlah konfirmasi pada titik infrastruktur secara atomik (menghindari race condition).
 */
const confirmPoint = async (req, res, next) => {
  try {
    const { id } = req.params;

    const updatedPoint = await InfrastrukturPoint.findByIdAndUpdate(
      id,
      { $inc: { jumlahKonfirmasi: 1 } },
      { new: true, runValidators: true }
    );

    if (!updatedPoint) {
      const error = new Error('Titik infrastruktur tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const pointObj = updatedPoint.toObject();
    pointObj.verified = (updatedPoint.jumlahKonfirmasi || 0) >= VERIFIED_THRESHOLD;

    return res.status(200).json(pointObj);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /infrastructure/points/:id/changed
 * Melaporkan perubahan pada titik infrastruktur (misal: sudah tidak beroperasi, pindah lokasi, dll).
 * Body: { jenisPerubahan, catatan, fotoUrl }
 * Hasil laporan di-push ke array `laporanPerubahan` milik point terkait.
 */
const reportPointChanged = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { jenisPerubahan, catatan, fotoUrl } = req.body;

    if (!jenisPerubahan || jenisPerubahan.trim() === '') {
      const error = new Error('Parameter jenisPerubahan wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const laporanBaru = {
      jenisPerubahan,
      catatan,
      fotoUrl,
      pelapor: req.user ? req.user.id : undefined,  
    };

    const updatedPoint = await InfrastrukturPoint.findByIdAndUpdate(
      id,
      { $push: { laporanPerubahan: laporanBaru } },
      { new: true, runValidators: true }
    );

    if (!updatedPoint) {
      const error = new Error('Titik infrastruktur tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const pointObj = updatedPoint.toObject();
    pointObj.verified = (updatedPoint.jumlahKonfirmasi || 0) >= VERIFIED_THRESHOLD;

    return res.status(200).json(pointObj);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPointsInBounds,
  getCategories,
  reportNewPoint,
  confirmPoint,
  reportPointChanged,
};
