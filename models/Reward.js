const mongoose = require('mongoose');
const { Schema } = mongoose;

const rewardSchema = new Schema(
  {
    nama: {
      type: String,
      trim: true,
      required: true,
    },
    deskripsi: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
    },
    kategori: {
      type: String,
      enum: ['voucher', 'merchandise', 'pulsa', 'donasi', 'lainnya'],
      default: 'lainnya',
    },
    xpDibutuhkan: {
      type: Number,
      required: true,
    },
    stok: {
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

module.exports = mongoose.model('Reward', rewardSchema);