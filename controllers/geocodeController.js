const { forwardGeocode, reverseGeocode } = require('../services/geocodeService');

/**
 * GET /geocode/search?query=<alamat>
 * Mencari koordinat berdasarkan alamat/nama tempat.
 * Response: [{ lat, lng, label }]
 */
const searchAddress = async (req, res, next) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      const error = new Error('Parameter query wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const results = await forwardGeocode(query);

    // Pastikan hasil berupa array (LocationIQ search.php mengembalikan array)
    const formattedResults = (Array.isArray(results) ? results : []).map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      label: item.display_name,
    }));

    return res.status(200).json(formattedResults);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /geocode/reverse?lat=<lat>&lng=<lng>
 * Mencari alamat berdasarkan koordinat.
 * Response: { label }
 */
const reverseGeocodeHandler = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (lat === undefined || lng === undefined) {
      const error = new Error('Parameter lat dan lng wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const result = await reverseGeocode(lat, lng);

    if (!result || !result.display_name) {
      const error = new Error('Alamat tidak ditemukan untuk koordinat tersebut.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      label: result.display_name,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  searchAddress,
  reverseGeocodeHandler,
};
