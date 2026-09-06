const express = require('express');

const router = express.Router();

const { getProfessionals, getProfessionalDetail } = require('../controllers/professionalController');

router.get('/', getProfessionals);
router.get('/:id', getProfessionalDetail);

module.exports = router;
