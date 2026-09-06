const crypto = require('crypto');

const User = require('../models/User');
const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const Reward = require('../models/Reward');
const UserReward = require('../models/UserReward');

const { calculateLevelInfo, getZonaFromLevel } = require('../services/gamifikasiService');

/**
 * Generate kode redeem acak sederhana (8 karakter alfanumerik uppercase).
 */
function generateKodeRedeem() {
  return crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

/**
 * GET /gamification/progression/:userId
 */
async function getProgression(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('xp trustScore level');
    if (!user) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const { xpToNext } = calculateLevelInfo(user.xp);
    const zona = getZonaFromLevel(user.level);

    return res.status(200).json({
      current_xp: user.xp,
      current_level: user.level,
      xp_to_next: xpToNext,
      trust_score: user.trustScore,
      zona,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /gamification/badges/:userId
 */
async function getBadges(req, res, next) {
  try {
    const { userId } = req.params;

    const semuaBadge = await Badge.find({ isActive: true });

    const userBadges = await UserBadge.find({ userId: userId });
    const userBadgeMap = new Map();
    userBadges.forEach((ub) => {
      userBadgeMap.set(ub.badgeId.toString(), ub);
    });

    const hasil = semuaBadge.map((badge) => {
      const ub = userBadgeMap.get(badge._id.toString());
      return {
        ...badge.toObject(),
        unlocked: Boolean(ub),
        unlockedAt: ub ? ub.unlockedAt : null,
      };
    });

    return res.status(200).json(hasil);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /gamification/rewards/:userId
 */
async function getRewards(req, res, next) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('xp');
    if (!user) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const semuaReward = await Reward.find({ isActive: true });
    const userRewards = await UserReward.find({ user: userId });

    const userRewardMap = new Map();
    userRewards.forEach((ur) => {
      userRewardMap.set(ur.reward.toString(), ur);
    });

    const hasil = semuaReward.map((reward) => {
      const ur = userRewardMap.get(reward._id.toString());
      const statusKlaim = ur ? ur.statusKlaim : 'belum_diklaim';
      const canClaim = statusKlaim !== 'sudah_diklaim' && user.xp >= reward.xpDibutuhkan && reward.stok > 0;

      return {
        ...reward.toObject(),
        statusKlaim,
        canClaim,
        diklaimPada: ur ? ur.diklaimPada : null,
      };
    });

    return res.status(200).json(hasil);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /gamification/rewards/:rewardId/claim
 */
async function claimReward(req, res, next) {
  try {
    const { rewardId } = req.params;
    const { user_id: userId } = req.body;

    const user = await User.findById(userId).select('xp');
    if (!user) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    const reward = await Reward.findById(rewardId);
    if (!reward || !reward.isActive) {
      const error = new Error('Reward tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    if (user.xp < reward.xpDibutuhkan) {
      const error = new Error('XP tidak cukup untuk klaim reward ini.');
      error.statusCode = 400;
      throw error;
    }

    if (reward.stok <= 0) {
      const error = new Error('Stok reward sudah habis.');
      error.statusCode = 400;
      throw error;
    }

    let userRewardTersimpan;
    try {
      userRewardTersimpan = await UserReward.findOneAndUpdate(
        { user: userId, reward: rewardId, statusKlaim: { $ne: 'sudah_diklaim' } },
        { $set: { statusKlaim: 'sudah_diklaim', diklaimPada, kodeRedeem } },
        { upsert: true, new: true }
      );
    } catch (err) {
      // err.code 11000 = index unique kena, artinya 2 request klaim bersamaan
      // dan salah satunya kalah — anggap "sudah pernah diklaim"
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Reward ini sudah pernah diklaim.' });
      }
      throw err;
    }

    if (!rewardSetelahDiklaim) {
      const error = new Error('Stok reward sudah habis.');
      error.statusCode = 400;
      throw error;
    }

    const kodeRedeem = generateKodeRedeem();
    const diklaimPada = new Date();

    await UserReward.findOneAndUpdate(
      { user: userId, reward: rewardId },
      {
        $set: {
          statusKlaim: 'sudah_diklaim',
          diklaimPada,
          kodeRedeem,
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      status_klaim: 'sudah_diklaim',
      claimed_at: diklaimPada,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProgression,
  getBadges,
  getRewards,
  claimReward,
};