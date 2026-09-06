const User = require('../models/User');
const Booking = require('../models/Booking');

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * POST /professional-bookings
 * Body: { mitraId, jenisLayanan, catatan, jadwalMulai, durasiJam }
 */
async function createBooking(req, res, next) {
  try {
    const { mitraId, jenisLayanan, catatan, jadwalMulai, durasiJam } = req.body;

    if (!mitraId || !jadwalMulai || !durasiJam) {
      const error = new Error('mitraId, jadwalMulai, dan durasiJam wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const mitra = await User.findOne({
      _id: mitraId,
      role: 'mitra_profesional',
      'profilMitra.statusVerifikasi': 'terverifikasi',
    });

    if (!mitra) {
      const error = new Error('Mitra profesional tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const tarifPerJam = mitra.profilMitra.tarifPerJam;
    const biaya = tarifPerJam * durasiJam;

    const jadwalMulaiDate = new Date(jadwalMulai);
    const jadwalSelesai = new Date(jadwalMulaiDate.getTime() + durasiJam * MS_PER_HOUR);

    const booking = await Booking.create({
      pemesan: req.user.id,
      mitra: mitraId,
      jenisLayanan,
      catatan,
      jadwalMulai: jadwalMulaiDate,
      jadwalSelesai,
      durasiJam,
      biaya,
      status: 'menunggu_konfirmasi',
    });

    return res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /professional-bookings/:id
 */
async function getBookingDetail(req, res, next) {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('mitra', 'username avatarUrl')
      .populate('pemesan', 'username avatarUrl');

    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /professional-bookings/:id/cancel
 * Body opsional: { alasanPembatalan }
 */
async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { alasanPembatalan } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (booking.status === 'selesai' || booking.status === 'dibatalkan') {
      const error = new Error(`Booking dengan status '${booking.status}' tidak bisa dibatalkan.`);
      error.statusCode = 409;
      throw error;
    }

    booking.status = 'dibatalkan';
    if (alasanPembatalan) {
      booking.alasanPembatalan = alasanPembatalan;
    }
    await booking.save();

    return res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /professional-bookings/:id/confirm
 * Hanya bisa dipanggil oleh user yang id-nya sama dengan booking.mitra
 */
async function confirmBooking(req, res, next) {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (booking.mitra.toString() !== req.user.id) {
      const error = new Error('Anda tidak memiliki akses untuk mengonfirmasi booking ini.');
      error.statusCode = 403;
      throw error;
    }

    if (booking.status !== 'menunggu_konfirmasi') {
      const error = new Error(`Booking dengan status '${booking.status}' tidak bisa dikonfirmasi.`);
      error.statusCode = 409;
      throw error;
    }

    booking.status = 'dikonfirmasi';
    await booking.save();

    return res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /professional-bookings/:id/complete
 * Hanya bisa dipanggil oleh user yang id-nya sama dengan booking.mitra
 */
async function completeBooking(req, res, next) {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      const error = new Error('Booking tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (booking.mitra.toString() !== req.user.id) {
      const error = new Error('Anda tidak memiliki akses untuk menyelesaikan booking ini.');
      error.statusCode = 403;
      throw error;
    }

    if (booking.status !== 'dikonfirmasi') {
      const error = new Error(`Booking dengan status '${booking.status}' tidak bisa diselesaikan.`);
      error.statusCode = 409;
      throw error;
    }

    booking.status = 'selesai';
    await booking.save();

    return res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBooking,
  getBookingDetail,
  cancelBooking,
  confirmBooking,
  completeBooking,
};