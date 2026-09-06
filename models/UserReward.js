const mongoose = require('mongoose');
const { Schema } = mongoose;

const userRewardSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rewardId: {
      type: Schema.Types.ObjectId,
      ref: 'Reward',
      required: true,
    },
    statusKlaim: {
      type: String,
      enum: ['belum_diklaim', 'sudah_diklaim'],
      default: 'belum_diklaim',
    },
    kodeRedeem: {
      type: String,
      trim: true,
      default: null,
    },
    diklaimPada: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userRewardSchema.index({ user: 1, reward: 1 }, { unique: true });

module.exports = mongoose.model('UserReward', userRewardSchema);