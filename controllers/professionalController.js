const User = require('../models/User');

/**
 * GET /professional-services
 * Query filter opsional: jenisLayanan
 */
async function getProfessionals(req, res, next) {
  try {
    const { jenisLayanan } = req.query;

    const filter = {
      role: 'mitra_profesional',
      'profilMitra.statusVerifikasi': 'terverifikasi',
    };

    if (jenisLayanan) {
      filter['profilMitra.jenisLayanan'] = jenisLayanan;
    }

    const professionals = await User.find(filter).select('-passwordHash');

    return res.status(200).json(professionals);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /professional-services/:id
 */
async function getProfessionalDetail(req, res, next) {
  try {
    const { id } = req.params;

    const professional = await User.findOne({
      _id: id,
      role: 'mitra_profesional',
      'profilMitra.statusVerifikasi': 'terverifikasi',
    }).select('-passwordHash');

    if (!professional) {
      const error = new Error('Mitra profesional tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json(professional);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfessionals,
  getProfessionalDetail,
};