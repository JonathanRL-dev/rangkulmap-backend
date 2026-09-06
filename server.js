require('express-async-errors');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ===== Middleware Dasar =====
app.use(cors({ origin: process.env.CORS_ALLOWED_ORIGINS.split(','), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Koneksi MongoDB Atlas =====
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ===== Routes =====
app.use('/auth', require('./routes/authRoutes'));
app.use('/uploads', require('./routes/uploadRoutes'));
app.use('/map', require('./routes/mapRoutes'));
app.use('/bantuan', require('./routes/bantuanRoutes'));
app.use('/sos', require('./routes/sosRoutes'));
app.use('/gamification', require('./routes/gamifikasiRoutes'));
app.use('/reviews', require('./routes/reviewRoutes'));
app.use('/professional-services', require('./routes/professionalRoutes'));
app.use('/professional-bookings', require('./routes/bookingRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'RangkulMap API is running' });
});

// ===== 404 Handler (route tidak ditemukan) =====
app.use((req, res, next) => {
  const error = new Error(`Route tidak ditemukan: ${req.originalUrl}`);
  error.statusCode = 404;
  error.errorType = 'notfound';
  next(error);
});

// ===== Global Error Handler =====
app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);

  let statusCode = err.statusCode || 500;
  let type = err.errorType || 'server';
  let message = err.message || 'Terjadi kesalahan pada server';

  // Mongoose CastError (misal: ID tidak valid)
  if (err.name === 'CastError') {
    statusCode = 400;
    type = 'validation';
    message = `Format ${err.path} tidak valid`;
  }

  // Mongoose ValidationError (misal: field required tidak diisi)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    type = 'validation';
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 400;
    type = 'validation';
    const field = Object.keys(err.keyValue || {}).join(', ');
    message = `${field} sudah digunakan`;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    type = 'validation';
    message = 'Token tidak valid atau sudah kedaluwarsa';
  }

  // Network / koneksi database terputus
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    statusCode = 503;
    type = 'network';
    message = 'Gagal terhubung ke database';
  }

  res.status(statusCode).json({
    type,
    message,
  });
});

// ===== Jalankan Server (httpServer, siap untuk Socket.io) =====
const http = require('http');
const httpServer = http.createServer(app);

const { initSocketService } = require('./services/socketService');
initSocketService(httpServer);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});

module.exports = { app, httpServer };