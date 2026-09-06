const mongoose = require('mongoose');
const { Schema } = mongoose;

const laporanPerubahanSchema = new Schema(
  {
    pelapor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    jenisPerubahan: {
      type: String,
      enum: ['rusak', 'diperbaiki', 'tidak_beroperasi', 'kondisi_baik', 'lainnya'],
      required: true,
    },
    catatan: {
      type: String,
      trim: true,
    },
    fotoUrl: {
      type: String,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const infrastrukturPointSchema = new Schema(
  {
    namaTempat: {
      type: String,
      trim: true,
      required: true,
    },
    kategori: {
      type: String,
      enum: ['rumah_sakit', 'posko_bencana', 'sumber_air', 'tempat_ibadah', 'jalur_evakuasi', 'lainnya'],
      required: true,
    },
    deskripsi: {
      type: String,
      trim: true,
    },
    alamat: {
      type: String,
      trim: true,
    },
    kondisiTerkini: {
      type: String,
      enum: ['baik', 'rusak_ringan', 'rusak_berat', 'tidak_beroperasi'],
      default: 'baik',
    },
    jumlahKonfirmasi: {
      type: Number,
      default: 0,
    },
    laporanPerubahan: [laporanPerubahanSchema],
    ditambahkanOleh: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    fotoUrl: {
      type: String,
    },

    // ===== Lokasi (GeoJSON) =====
    lokasi: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
  },
  { timestamps: true }
);

// ===== Index Geospasial =====
infrastrukturPointSchema.index({ lokasi: '2dsphere' });

module.exports = mongoose.model('InfrastrukturPoint', infrastrukturPointSchema);