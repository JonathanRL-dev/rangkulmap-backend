const User = require('../models/User');
const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');

const XP_PER_LEVEL = 100; // boleh diubah nanti — total 20 level, level 20 butuh 1900 XP kumulatif

/**
 * Hitung level & sisa XP menuju level berikutnya dari total XP.
 * @param {number} xp
 * @returns {{ level: number, xpToNext: number }}
 */
function calculateLevelInfo(xp) {
  const level = Math.min(20, Math.floor(xp / XP_PER_LEVEL) + 1);
  const xpToNext = level >= 20 ? 0 : XP_PER_LEVEL - (xp % XP_PER_LEVEL);
  return { level, xpToNext };
}

/**
 * Ambil label zona berdasarkan level.
 * @param {number} level
 * @returns {string}
 */
function getZonaFromLevel(level) {
  if (level >= 1 && level <= 5) return 'Newbie';
  if (level >= 6 && level <= 10) return 'Intermediate';
  if (level >= 11 && level <= 15) return 'Advanced';
  if (level >= 16 && level <= 20) return 'Expert';
  return 'Newbie';
}

/**
 * Tambahkan XP ke user secara atomic, sinkronkan field level jika berubah,
 * lalu unlock badge baru yang syaratnya sudah terpenuhi.
 * @param {string} userId
 * @param {number} xpAmount
 * @returns {Promise<{ xp: number, level: number, leveledUp: boolean, newlyUnlockedBadgeIds: string[] }>}
 */
async function applyXpGain(userId, xpAmount) {
  // 1. Increment XP secara atomic
  const userSetelahIncXp = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: xpAmount } },
    { new: true }
  );

  const xpBaru = userSetelahIncXp.xp;
  const levelLama = userSetelahIncXp.level;

  // 2. Hitung ulang level dari xp terbaru
  const { level: levelBaru } = calculateLevelInfo(xpBaru);
  const leveledUp = levelBaru !== levelLama;

  // 3. Update field level secara terpisah (panggilan $set terpisah dari $inc, hindari race condition)
  if (leveledUp) {
    await User.findByIdAndUpdate(userId, { $set: { level: levelBaru } });
  }

  // 4. Cek badge yang syaratnya sudah terpenuhi tapi belum di-unlock user ini
  const newlyUnlockedBadgeIds = [];

  const eligibleBadges = await Badge.find({ syaratXp: { $lte: xpBaru } });

  for (const badge of eligibleBadges) {
    const sudahPunya = await UserBadge.findOne({
      userId: userId,
      badgeId: badge._id,
    });

    if (sudahPunya) continue;

    try {
      await UserBadge.create({
        userId: userId,
        badgeId: badge._id,
      });
      newlyUnlockedBadgeIds.push(badge._id);
    } catch (err) {
      // Abaikan error duplicate key (index unique di UserBadge.js sudah mencegah dobel)
      if (err.code !== 11000) {
        throw err;
      }
    }
  }

  return {
    xp: xpBaru,
    level: levelBaru,
    leveledUp,
    newlyUnlockedBadgeIds,
  };
}

module.exports = {
  XP_PER_LEVEL,
  calculateLevelInfo,
  getZonaFromLevel,
  applyXpGain,
};
