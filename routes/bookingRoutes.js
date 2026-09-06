const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const {
  createBooking,
  getBookingDetail,
  cancelBooking,
  confirmBooking,
  completeBooking,
} = require('../controllers/bookingController');

router.post('/', authMiddleware, createBooking);
router.get('/:id', authMiddleware, getBookingDetail);
router.post('/:id/cancel', authMiddleware, cancelBooking);
router.post('/:id/confirm', authMiddleware, confirmBooking);
router.post('/:id/complete', authMiddleware, completeBooking);

module.exports = router;
