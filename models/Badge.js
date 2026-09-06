const mongoose = require('mongoose');
const { Schema } = mongoose;

const badgeSchema = new Schema(
  {
    nama: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    deskripsi: {
      type: String,
      trim: true,
    },
    iconUrl: {
      type: String,
    },
    kategori: {
      type: String,
      enum: ['relawan', 'pencari_bantuan', 'mitra_profesional', 'umum'],
      default: 'umum',
    },
    syaratXp: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Badge', badgeSchema);