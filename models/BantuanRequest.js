const mongoose = require('mongoose');
const { Schema } = mongoose;

const bantuanRequestSchema = new Schema(
  {
    pemohon: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    relawanDitugaskan: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    kategori: {
      type: String,
      enum: ['medis', 'logistik', 'evakuasi', 'psikologis', 'lainnya'],
      required: true,
    },
    deskripsi: {
      type: String,
      trim: true,
      required: true,
    },
    fotoUrls: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['menunggu', 'diterima', 'dalam_perjalanan', 'selesai', 'dibatalkan'],
      default: 'menunggu',
    },
    prioritas: {
      type: String,
      enum: ['rendah', 'sedang', 'tinggi', 'darurat'],
      default: 'sedang',
    },
    alamat: {
      type: String,
      trim: true,
    },

    // ===== Lokasi (GeoJSON) =====
    lokasi: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    selesaiPada: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ===== Index Geospasial =====
bantuanRequestSchema.index({ lokasi: '2dsphere' });

module.exports = mongoose.model('BantuanRequest', bantuanRequestSchema);