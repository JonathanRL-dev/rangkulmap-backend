const mongoose = require('mongoose');
const { Schema } = mongoose;

// ===== Sub-Schema: Profil Relawan =====
const profilRelawanSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['tersedia', 'sedang_membantu', 'offline'],
      default: 'offline',
    },
    fotoKtpUrl: {
      type: String,
      select: false, // dokumen sensitif, jangan otomatis ikut ter-fetch di query biasa
    },
    fotoSwafotoUrl: {
      type: String,
      select: false,
    },
    statusVerifikasi: {
      type: String,
      enum: ['pending', 'terverifikasi', 'ditolak'],
      default: 'pending',
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    totalBantuanSelesai: {
      type: Number,
      default: 0,
    },
    radiusJangkauanKm: {
      type: Number,
      default: 5,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  { _id: false }
);

// ===== Sub-Schema: Profil Mitra Profesional =====
const profilMitraSchema = new Schema(
  {
    namaInstansi: { type: String, trim: true },
    jenisLayanan: { type: String, trim: true }, // = spesialisasi
    nomorLisensi: { type: String, trim: true },
    tarifPerJam: {
      type: Number,
      min: 0,
    },
    statusVerifikasi: {
      type: String,
      enum: ['pending', 'terverifikasi', 'ditolak'],
      default: 'pending',
    },
    dokumenVerifikasiUrl: {
      type: String,
      select: false,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { _id: false }
);

// ===== Sub-Schema: Profil Pencari Bantuan =====
const profilPencariBantuanSchema = new Schema(
  {
    jenisKebutuhan: [
      {
        type: String,
        trim: true,
      },
    ],
    totalLaporanDibuat: {
      type: Number,
      default: 0,
    },
    kontakDarurat: [
      {
        nama: { type: String, trim: true },
        nomorTelepon: { type: String, trim: true },
        hubungan: { type: String, trim: true },
      },
    ],
    catatanKhusus: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// ===== Main Schema: User =====
const userSchema = new Schema(
  {
    accountId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Format email tidak valid'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['pencari_bantuan', 'relawan', 'mitra_profesional'],
      required: true,
    },

    // ===== Gamifikasi =====
    trustScore: {
      type: Number,
      default: 100,
    },
    xp: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },

    // ===== Sub-dokumen Profil (sesuai role) =====
    profilRelawan: {
      type: profilRelawanSchema,
      default: undefined,
    },
    profilMitra: {
      type: profilMitraSchema,
      default: undefined,
    },
    profilPencariBantuan: {
      type: profilPencariBantuanSchema,
      default: undefined,
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
        default: [0, 0],
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// ===== Index Geospasial =====
userSchema.index({ lokasi: '2dsphere' });

module.exports = mongoose.model('User', userSchema);