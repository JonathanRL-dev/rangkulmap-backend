const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSettingsSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    textSize: {
      type: String,
      enum: ['kecil', 'sedang', 'besar', 'sangat_besar'],
      default: 'sedang',
    },
    kontrasTinggi: {
      type: Boolean,
      default: false,
    },
    bahasa: {
      type: String,
      enum: ['id', 'en'],
      default: 'id',
    },
    voiceCommandOn: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserSettings', userSettingsSchema);