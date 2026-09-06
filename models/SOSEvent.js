const mongoose = require('mongoose');
const { Schema } = mongoose;

const responderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['menunggu', 'menuju', 'tiba', 'menolak'],
      default: 'menunggu',
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const konfirmasiSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    catatan: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const sosEventSchema = new Schema(
  {
    pelapor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jenisDarurat: {
      type: String,
      enum: ['kecelakaan', 'bencana_alam', 'kekerasan', 'medis', 'kebakaran', 'lainnya'],
      required: true,
    },
    deskripsi: {
      type: String,
      trim: true,
    },
    stage: {
      type: String,
      enum: ['pending', 'confirming', 'escalated', 'resolved', 'cancelled'],
      default: 'pending',
    },
    konfirmasiSaksi: [konfirmasiSchema],
    respondenDitugaskan: [responderSchema],
    eskalasiKe: {
      type: String,
      enum: ['relawan_terdekat', 'mitra_profesional', 'pihak_berwajib', null],
      default: null,
    },
    fotoUrls: [
      {
        type: String,
      },
    ],

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

    resolvedPada: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ===== Index Geospasial =====
sosEventSchema.index({ lokasi: '2dsphere' });

module.exports = mongoose.model('SOSEvent', sosEventSchema);