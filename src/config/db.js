// Paksa Node.js menggunakan IPv4 (Mencegah error 'fetch failed' di Windows/Node 18+)
require("dns").setDefaultResultOrder("ipv4first");

const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    port: process.env.DB_PORT,
    logging: false,
    define: {
      timestamps: false,
      freezeTableName: true,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // PERUBAHAN UTAMA: Supabase WAJIB menggunakan SSL
    dialectOptions: {
      ssl: {
        require: true, // Wajib true untuk Supabase
        rejectUnauthorized: false, // Menghindari error sertifikat di beberapa environment
      },
    },
  },
);

// Test koneksi (Opsional, agar kamu tahu kalau berhasil connect)
sequelize
  .authenticate()
  .then(() => console.log("✅ Database terhubung ke Supabase!"))
  .catch((err) => console.error("❌ Gagal terhubung ke database:", err));

module.exports = sequelize;
