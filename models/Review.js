const mongoose = require('mongoose');
const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    pemberiReview: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    penerimaReview: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionType: {
      type: String,
      enum: ['bantuan_request', 'booking'],
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'sessionModelName',
    },
    // Field bantu internal agar refPath bisa resolve ke collection yang benar
    sessionModelName: {
      type: String,
      required: true,
      enum: ['BantuanRequest', 'Booking'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    komentar: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);