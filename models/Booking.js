const mongoose = require('mongoose');
const { Schema } = mongoose;

const bookingSchema = new Schema(
  {
    pemesan: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mitra: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jenisLayanan: {
      type: String,
      trim: true,
      required: true,
    },
    catatan: {
      type: String,
      trim: true,
    },
    jadwalMulai: {
      type: Date,
      required: true,
    },
    durasiJam: {
      type: Number,
      required: true,
      min: 0.5,
    },
    jadwalSelesai: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['menunggu_konfirmasi', 'dikonfirmasi', 'selesai', 'dibatalkan'],
      default: 'menunggu_konfirmasi',
    },
    biaya: {
      type: Number,
      default: 0,
    },
    alasanPembatalan: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);