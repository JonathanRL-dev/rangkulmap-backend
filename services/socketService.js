const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * ================================================================================
 * KONTRAK EVENT REALTIME — WAJIB DIPAKAI PERSIS OLEH SEMUA EMITTER (mis. modul SOS)
 * Nama event & key payload HARUS snake_case seperti di bawah, karena ini yang dibaca
 * frontend. JANGAN diganti ke camelCase.
 *
 * 'sos:progress'
 *   { sos_id, status, elapsed_seconds, notified_volunteers, responded_volunteers }
 *
 * 'volunteer:location_update'
 *   { sos_id, volunteer_id, latitude, longitude, eta_minutes }
 *
 * 'sos:status_change'
 *   { sos_id, status, changed_at }
 * ================================================================================
 */

let io = null;

/**
 * Inisialisasi Socket.io server di atas httpServer yang sudah ada.
 * Harus dipanggil SATU KALI saat startup, tepat setelah httpServer dibuat.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
const initSocketService = (httpServer) => {
  if (io) {
    // Cegah inisialisasi ganda (misal karena hot-reload atau salah panggil 2x)
    return io;
  }

  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const vercelPreviewRegex = /^https:\/\/rangkulmap-.*\.vercel\.app$/;

  const corsOriginHandler = (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || vercelPreviewRegex.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  };

  io = new Server(httpServer, {
    cors: {
      origin: corsOriginHandler,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  // ===== Middleware autentikasi JWT untuk setiap koneksi socket =====
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;

      if (!token) {
        const error = new Error('Authentication error: token tidak ditemukan.');
        return next(error);
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (jwtErr) {
        const error = new Error('Authentication error: token tidak valid atau kedaluwarsa.');
        return next(error);
      }

      // Payload JWT hanya berisi { id, username, role } (lihat authController.js),
      // sehingga accountId perlu diambil dari database untuk dipakai sebagai nama room.
      const user = await User.findById(decoded.id);

      if (!user) {
        const error = new Error('Authentication error: user tidak ditemukan.');
        return next(error);
      }

      socket.user = {
        id: user._id.toString(),
        accountId: user.accountId,
        username: user.username,
        role: user.role,
      };

      next();
    } catch (err) {
      next(new Error('Authentication error: gagal memverifikasi koneksi.'));
    }
  });

  // ===== Handler koneksi =====
  io.on('connection', (socket) => {
    // Setiap user otomatis join room bernama accountId miliknya sendiri.
    // Emitter (mis. modul SOS) cukup broadcast ke io.to(accountId) untuk
    // menjangkau semua device/tab milik user tersebut.
    if (socket.user && socket.user.accountId) {
      socket.join(socket.user.accountId);
    }

    socket.on('disconnect', () => {
      // Socket.io otomatis membersihkan keanggotaan room saat disconnect,
      // tidak perlu socket.leave() manual di sini.
    });
  });

  return io;
};

/**
 * Ambil instance Socket.io yang sudah diinisialisasi.
 * Dipakai oleh controller/service lain (mis. sosController.js) untuk emit event,
 * contoh: getIo().to(accountId).emit('sos:progress', { ... }).
 *
 * @returns {import('socket.io').Server}
 */
const getIo = () => {
  if (!io) {
    throw new Error(
      'Socket.io belum diinisialisasi. Pastikan initSocketService(httpServer) sudah dipanggil saat startup.'
    );
  }
  return io;
};

module.exports = {
  initSocketService,
  getIo,
};
