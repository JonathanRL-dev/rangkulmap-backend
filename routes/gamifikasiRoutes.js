const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const {
  getProgression,
  getBadges,
  getRewards,
  claimReward,
} = require('../controllers/gamifikasiController');

/**
 * Middleware: pastikan req.user.id sama dengan :userId di params.
 * User hanya boleh lihat progresnya sendiri (belum ada role admin).
 */
function requireOwnUserId(req, res, next) {
  const { userId } = req.params;
  if (req.user.id !== userId) {
    return res.status(403).json({ message: 'Anda tidak memiliki akses ke data user ini.' });
  }
  return next();
}

/**
 * Middleware: pastikan req.user.id sama dengan user_id di body (untuk claimReward).
 */
function requireOwnUserIdInBody(req, res, next) {
  const { user_id: userId } = req.body;
  if (!userId || req.user.id !== userId) {
    return res.status(403).json({ message: 'Anda tidak memiliki akses untuk klaim reward ini.' });
  }
  return next();
}

router.get('/progression/:userId', authMiddleware, requireOwnUserId, getProgression);
router.get('/badges/:userId', authMiddleware, requireOwnUserId, getBadges);
router.get('/rewards/:userId', authMiddleware, requireOwnUserId, getRewards);
router.post('/rewards/:rewardId/claim', authMiddleware, requireOwnUserIdInBody, claimReward);

module.exports = router;
