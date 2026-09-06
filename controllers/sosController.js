const SOSEvent = require('../models/SOSEvent');
const User = require('../models/User');
const { sendPushNotification } = require('../services/onesignalService');
const { getIo } = require('../services/socketService');

const JENIS_DARURAT_ENUM = [
  'kecelakaan',
  'bencana_alam',
  'kekerasan',
  'medis',
  'kebakaran',
  'lainnya',
];

const RESPOND_ENUM = ['menuju', 'menolak'];

const MAX_RESPONDERS = 3;
const NEARBY_VOLUNTEER_RADIUS_METERS = 10000; // 10 km, radius pencarian relawan terdekat untuk SOS

/**
 * POST /
 * Membuat SOS event baru.
 * Body: { jenisDarurat, deskripsi, lokasi }
 * pelapor otomatis diisi dari req.user.id, stage awal 'pending'.
 * Setelah tersimpan, cari maksimal 3 relawan terdekat & kirim push notification,
 * lalu naikkan stage ke 'confirming'.
 */
const triggerSos = async (req, res, next) => {
  try {
    const { jenisDarurat, deskripsi, lokasi } = req.body;

    if (!jenisDarurat || !JENIS_DARURAT_ENUM.includes(jenisDarurat)) {
      const error = new Error(
        `Parameter jenisDarurat wajib diisi dan harus salah satu dari: ${JENIS_DARURAT_ENUM.join(', ')}.`
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

    const sos = new SOSEvent({
      pelapor: req.user.id,
      jenisDarurat,
      deskripsi,
      lokasi,
      stage: 'pending',
    });

    await sos.save();

    // Cari maksimal 3 relawan terdekat berstatus 'tersedia' dari titik lokasi SOS
    const nearbyVolunteers = await User.find({
      role: 'relawan',
      'profilRelawan.status': 'tersedia',
      lokasi: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: NEARBY_VOLUNTEER_RADIUS_METERS,
        },
      },
    }).limit(MAX_RESPONDERS);

    if (nearbyVolunteers.length > 0) {
      // status tidak diisi manual — otomatis default 'menunggu' sesuai responderSchema
      sos.respondenDitugaskan = nearbyVolunteers.map((volunteer) => ({
        user: volunteer._id,
      }));
      sos.stage = 'confirming';

      await sos.save();

      const targetAccountIds = nearbyVolunteers
        .map((volunteer) => volunteer.accountId)
        .filter(Boolean);

      if (targetAccountIds.length > 0) {
        // 1. Broadcast Socket.io realtime ke accountId tiap relawan
        try {
          const io = getIo();
          targetAccountIds.forEach((accountId) => {
            io.to(accountId).emit('sos:new_request', {
              sos_id: sos._id,
              jenisDarurat: sos.jenisDarurat,
              lokasi: sos.lokasi,
            });
          });
        } catch (ioErr) {
          console.error('Gagal broadcast socket trigger SOS:', ioErr.message);
        }

        // 2. Kirim Push Notification OneSignal
        try {
          await sendPushNotification(
            targetAccountIds,
            'Permintaan SOS Darurat',
            'Ada laporan darurat di dekat lokasi Anda. Mohon konfirmasi kesediaan Anda untuk membantu.',
            {
              type: 'sos_micro_confirmation',
              sos_event_id: sos._id,
            }
          );
        } catch (pushErr) {
          console.error('Gagal mengirim push notification SOS:', pushErr.message);
        }
      }
    }

    return res.status(201).json(sos);
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: pastikan req.user.id memang terdaftar di respondenDitugaskan SOS event ini
 * sebelum mengizinkan aksi respond/location update. SOS event yang sudah diambil
 * disimpan di req.sosEvent agar controller berikutnya tidak perlu query ulang.
 */
const ensureResponderAssigned = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sos = await SOSEvent.findById(id);

    if (!sos) {
      const error = new Error('SOS event tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const isAssigned = sos.respondenDitugaskan.some(
      (responder) => responder.user && responder.user.toString() === req.user.id
    );

    if (!isAssigned) {
      const error = new Error('Anda tidak ditugaskan sebagai responden pada SOS event ini.');
      error.statusCode = 403;
      throw error;
    }

    req.sosEvent = sos;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * POST /:id/respond
 * Responder (relawan yang ditugaskan) merespons SOS event.
 * Body: { response: 'menuju' | 'menolak' }
 * Broadcast 'sos:status_change' dan 'sos:progress' ke room sos:<id>.
 */
const respondSos = async (req, res, next) => {
  try {
    const { response } = req.body;

    if (!response || !RESPOND_ENUM.includes(response)) {
      const error = new Error(
        `Parameter response wajib diisi dan harus salah satu dari: ${RESPOND_ENUM.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const sos = req.sosEvent; // sudah diambil & divalidasi oleh middleware ensureResponderAssigned

    const responderEntry = sos.respondenDitugaskan.find(
      (responder) => responder.user && responder.user.toString() === req.user.id
    );

    responderEntry.status = response;
    responderEntry.respondedAt = new Date();

    await sos.save();

    const sosId = sos._id.toString();
    const io = getIo();

    const sosWithAccounts = await sos.populate([
      { path: 'pelapor', select: 'accountId' },
      { path: 'respondenDitugaskan.user', select: 'accountId' },
    ]);

    const targetRooms = [
      sosWithAccounts.pelapor?.accountId,
      ...sosWithAccounts.respondenDitugaskan.map((r) => r.user?.accountId),
    ].filter(Boolean);

    const elapsedSeconds = Math.floor((Date.now() - sos.createdAt.getTime()) / 1000);
    const notifiedVolunteers = sos.respondenDitugaskan.length;
    const respondedVolunteers = sos.respondenDitugaskan.filter(
      (responder) => responder.status !== 'menunggu'
    ).length;

    targetRooms.forEach((room) => {
      io.to(room).emit('sos:status_change', {
        sos_id: sosId,
        status: sos.stage,
        changed_at: new Date(),
      });

      io.to(room).emit('sos:progress', {
        sos_id: sosId,
        status: sos.stage,
        elapsed_seconds: elapsedSeconds,
        notified_volunteers: notifiedVolunteers,
        responded_volunteers: respondedVolunteers,
      });
    });

    return res.status(200).json(sos);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /:id/location
 * Relawan berstatus 'menuju' mengirim update lokasi realtime.
 * Body: { lat, lng }
 * TIDAK disimpan ke DB — hanya diteruskan sebagai event realtime ke room sos:<id>.
 */
const updateVolunteerLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      const error = new Error('Parameter lat dan lng wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      const error = new Error('Parameter lat dan lng harus berupa angka yang valid.');
      error.statusCode = 400;
      throw error;
    }

    const sos = req.sosEvent;

    const responderEntry = sos.respondenDitugaskan.find(
      (responder) => responder.user && responder.user.toString() === req.user.id
    );

    if (!responderEntry || responderEntry.status !== 'menuju') {
      const error = new Error(
        'Hanya responden berstatus "menuju" yang dapat mengirim update lokasi.'
      );
      error.statusCode = 403;
      throw error;
    }

    const sosId = sos._id.toString();
    await sos.populate('pelapor', 'accountId');
    const io = getIo();
    
    if (sos.pelapor && sos.pelapor.accountId) {
      io.to(sos.pelapor.accountId).emit('volunteer:location_update', {
        sos_id: sosId,
        volunteer_id: req.user.id,
        latitude: parsedLat,
        longitude: parsedLng,
        eta_minutes: null,
      });
    }

    return res.status(200).json({
      message: 'Lokasi berhasil dikirim secara realtime.',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /:id/cancel
 * Membatalkan SOS event.
 * stage -> 'cancelled', resolvedPada -> Date.now()
 */
const cancelSos = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sos = await SOSEvent.findById(id);

    if (!sos) {
      const error = new Error('SOS event tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    // Hanya pelapor yang boleh membatalkan SOS event miliknya sendiri
    if (sos.pelapor.toString() !== req.user.id) {
      const error = new Error('Hanya pelapor yang dapat membatalkan SOS event ini.');
      error.statusCode = 403;
      throw error;
    }

    if (sos.stage === 'resolved' || sos.stage === 'cancelled') {
      const error = new Error(
        `SOS event tidak dapat dibatalkan karena stage-nya sudah '${sos.stage}'.`
      );
      error.statusCode = 409;
      throw error;
    }

    sos.stage = 'cancelled';
    sos.resolvedPada = Date.now();

    await sos.save();

    const sosId = sos._id.toString();

    try {
      const io = getIo();

      // Populate accountId pelapor & seluruh relawan
      const sosWithAccounts = await sos.populate([
        { path: 'pelapor', select: 'accountId' },
        { path: 'respondenDitugaskan.user', select: 'accountId' },
      ]);

      // Gabungkan daftar accountId
      const targetRooms = [
        sosWithAccounts.pelapor?.accountId,
        ...sosWithAccounts.respondenDitugaskan.map((r) => r.user?.accountId),
      ].filter(Boolean);

      // Broadcast ke masing-masing accountId
      targetRooms.forEach((room) => {
        io.to(room).emit('sos:status_change', {
          sos_id: sosId,
          status: sos.stage,
          changed_at: new Date(),
        });
      });
    } catch (ioErr) {
      console.error('Gagal broadcast pembatalan SOS:', ioErr.message);
    }

    return res.status(200).json(sos);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /:id
 * Mengambil detail SOS event, dengan pelapor dan respondenDitugaskan.user ter-populate.
 */
const getSosStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sos = await SOSEvent.findById(id)
      .populate('pelapor')
      .populate('respondenDitugaskan.user');

    if (!sos) {
      const error = new Error('SOS event tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(sos);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  triggerSos,
  respondSos,
  updateVolunteerLocation,
  cancelSos,
  getSosStatus,
  ensureResponderAssigned,
};
