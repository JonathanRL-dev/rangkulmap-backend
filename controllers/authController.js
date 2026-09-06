const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const SALT_ROUNDS = 10;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Enum role sesuai schema User.js — TIDAK ada default di schema, sehingga wajib divalidasi di sini
const ROLE_ENUM = ['pencari_bantuan', 'relawan', 'mitra_profesional'];

/**
 * Helper untuk membuat JWT token dari data user.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      accountId: user.accountId,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Helper untuk membersihkan field sensitif (passwordHash) dari object user
 * sebelum dikirim sebagai response.
 */
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.passwordHash;
  return userObj;
};

/**
 * POST /register
 * Registrasi user baru tanpa OTP, otomatis login (langsung kembalikan token).
 * Body: { username, email, password, role, ...field lain sesuai schema }
 */
const register = async (req, res, next) => {
  try {
    const { username, email, password, role, lokasi } = req.body;

    if (!username || !email || !password) {
      const error = new Error('Username, email, dan password wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    if (!role || !ROLE_ENUM.includes(role)) {
      const error = new Error(
        `Parameter role wajib diisi dan harus salah satu dari: ${ROLE_ENUM.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }

    // Cek apakah email atau username sudah terdaftar
    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      const error = new Error('Email atau username sudah terdaftar.');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // accountId wajib & unik di schema — dipakai juga sebagai external_id di OneSignal,
    // jadi di-generate sekali di sini dan tidak pernah berubah selama akun aktif.
    const accountId = require('crypto').randomBytes(4).toString('hex').toUpperCase();

    const newUserData = {
      accountId,
      username,
      email,
      passwordHash,
      role,
    };

    if (
      lokasi &&
      lokasi.type === 'Point' &&
      Array.isArray(lokasi.coordinates) &&
      lokasi.coordinates.length === 2
    ) {
      newUserData.lokasi = lokasi;
    }

    // Sub-dokumen profil di schema punya `default: undefined`, artinya tidak akan
    // pernah terisi (termasuk default internalnya, mis. profilRelawan.status) kecuali
    // di-assign eksplisit di sini sesuai role user.
    if (role === 'relawan') {
      newUserData.profilRelawan = {};
    } else if (role === 'mitra_profesional') {
      newUserData.profilMitra = {};
    } else if (role === 'pencari_bantuan') {
      newUserData.profilPencariBantuan = {};
    }

    const newUser = new User(newUserData);

    await newUser.save();

    const token = generateToken(newUser);

    return res.status(201).json({
      user: sanitizeUser(newUser),
      access_token: token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /login
 * Login user menggunakan email/username + password (bcrypt compare) lalu terbitkan JWT.
 * Body: { identifier, password }  -> identifier bisa email atau username
 */
const login = async (req, res, next) => {
  try {
    const { identifier, email, username, password } = req.body;

    const loginIdentifier = identifier || email || username;

    if (!loginIdentifier || !password) {
      const error = new Error('Email/username dan password wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    }).select('+passwordHash');

    if (!user) {
      const error = new Error('Email/username atau password salah.');
      error.statusCode = 401;
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const error = new Error('Email/username atau password salah.');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken(user);

    return res.status(200).json({
      user: sanitizeUser(user),
      access_token: token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /me
 * Mengembalikan data user yang sedang login berdasarkan req.user.id (dari authMiddleware).
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /me/username
 * Memperbarui username user yang sedang login.
 * Body: { username }
 */
const updateUsername = async (req, res, next) => {
  try {
    const { username } = req.body;

    if (!username || username.trim() === '') {
      const error = new Error('Username baru wajib diisi.');
      error.statusCode = 400;
      throw error;
    }

    // Cek apakah username sudah dipakai user lain
    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.user.id },
    });

    if (existingUser) {
      const error = new Error('Username sudah digunakan oleh pengguna lain.');
      error.statusCode = 409;
      throw error;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { username },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    // Terbitkan token baru karena payload (username) berubah
    const token = generateToken(updatedUser);

    return res.status(200).json({
      user: sanitizeUser(updatedUser),
      access_token: token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /me/location
 * Memperbarui lokasi user secara berkala atau saat user berpindah
 */
const updateLocation = async (req, res, next) => {
  try {
    const { lokasi } = req.body;

    // Di dalam updateLocation, ubah blok if validasinya menjadi:
    if (
      !lokasi ||
      lokasi.type !== 'Point' ||
      !Array.isArray(lokasi.coordinates) ||
      lokasi.coordinates.length !== 2 ||
      typeof lokasi.coordinates[0] !== 'number' || // Pastikan index 0 angka
      typeof lokasi.coordinates[1] !== 'number' || // Pastikan index 1 angka
      lokasi.coordinates[0] < -180 || lokasi.coordinates[0] > 180 || // Cek batas Longitude
      lokasi.coordinates[1] < -90 || lokasi.coordinates[1] > 90      // Cek batas Latitude
    ) {
      const error = new Error('Parameter lokasi wajib berupa GeoJSON Point yang valid (Longitude: -180 s/d 180, Latitude: -90 s/d 90).');
      error.statusCode = 400;
      throw error;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { lokasi },
      { new: true, runValidators: true }
    );

    // TAMBAHKAN BLOK INI
    if (!updatedUser) {
      const error = new Error('User tidak ditemukan.');
      error.statusCode = 404;
      throw error;
    }

    return res.status(200).json({ user: sanitizeUser(updatedUser) });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateUsername,
  updateLocation,
};
