const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    penerima: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    judul: {
      type: String,
      trim: true,
      required: true,
    },
    pesan: {
      type: String,
      trim: true,
      required: true,
    },
    tipe: {
      type: String,
      enum: ['sos', 'bantuan', 'booking', 'reward', 'sistem', 'lainnya'],
      default: 'lainnya',
    },
    referensiId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    dikirimViaOneSignal: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);