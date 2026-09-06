const express = require('express');

const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const { submitReview, getReviews } = require('../controllers/reviewController');

router.post('/', authMiddleware, submitReview);
router.get('/', getReviews);

module.exports = router;
