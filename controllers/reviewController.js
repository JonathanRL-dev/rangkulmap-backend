const Review = require('../models/Review');
const BantuanRequest = require('../models/BantuanRequest');
const Booking = require('../models/Booking');

/**
 * POST /reviews
 * Body: { sessionId, penerimaReview, rating, komentar }
 * pemberiReview diambil dari req.user.id
 */
async function submitReview(req, res, next) {
  try {
    const { sessionId, penerimaReview, rating, komentar } = req.body;
    const pemberiReview = req.user.id;

    if (!sessionId || !penerimaReview) {
      const error = new Error('sessionId dan penerimaReview wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const ratingNumber = Number(rating);
    if (Number.isNaN(ratingNumber) || ratingNumber < 1 || ratingNumber > 5) {
      const error = new Error('Rating harus berupa angka antara 1 sampai 5.');
      error.statusCode = 400;
      throw error;
    }

    // Deteksi otomatis sessionModelName: cek BantuanRequest dulu, lalu Booking
    let sessionModelName;

    const bantuanRequest = await BantuanRequest.findById(sessionId);
    if (bantuanRequest) {
      sessionModelName = 'BantuanRequest';
    } else {
      const booking = await Booking.findById(sessionId);
      if (booking) {
        sessionModelName = 'Booking';
      }
    }

    if (!sessionModelName) {
      const error = new Error('Sesi tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    // Setelah sessionModelName ditemukan, sebelum Review.create():
    const sessionDoc = sessionModelName === 'BantuanRequest' ? bantuanRequest : booking;

    // 1. Pastikan sesi memang sudah selesai
    if (sessionDoc.status !== 'selesai') {
      return res.status(409).json({ message: 'Review hanya bisa dikirim untuk sesi yang sudah selesai.' });
    }

    // 2. Pastikan req.user.id memang salah satu pihak yang terlibat di sesi ini
    const pihakTerlibat = sessionModelName === 'BantuanRequest'
      ? [sessionDoc.pemohon.toString(), sessionDoc.relawanDitugaskan?.toString()]
      : [sessionDoc.pemesan.toString(), sessionDoc.mitra.toString()];

    if (!pihakTerlibat.includes(pemberiReview)) {
      return res.status(403).json({ message: 'Anda tidak terlibat dalam sesi ini.' });
    }

    // 3. (Opsional tapi disarankan) penerimaReview harus salah satu pihak LAIN di sesi ini,
    // supaya orang tidak bisa review dirinya sendiri
    if (!pihakTerlibat.includes(penerimaReview) || penerimaReview === pemberiReview) {
      return res.status(400).json({ message: 'penerimaReview tidak valid untuk sesi ini.' });
    }

    const review = await Review.create({
      sessionId,
      sessionModelName,
      pemberiReview,
      penerimaReview,
      rating: ratingNumber,
      komentar,
    });

    return res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /reviews?targetId=...&targetType=...
 * targetType bersifat opsional dan tidak dipakai untuk filter query,
 * karena field penerimaReview di schema selalu berupa User id apa pun targetType-nya.
 */
async function getReviews(req, res, next) {
  try {
    const { targetId, targetType } = req.query;

    if (!targetId) {
      const error = new Error('targetId wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const reviews = await Review.find({ penerimaReview: targetId })
      .populate('pemberiReview', 'username avatarUrl')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      targetId,
      targetType: targetType || null,
      reviews,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  submitReview,
  getReviews,
};