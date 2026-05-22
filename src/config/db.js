// Paksa Node.js menggunakan IPv4
require("dns").setDefaultResultOrder("ipv4first");

const { Sequelize } = require("sequelize");
const pg = require("pg"); // <-- 1. TAMBAHKAN IMPORT INI
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    dialectModule: pg, // <-- 2. TAMBAHKAN INI (JURUS AMPUH VERCEL)
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
    dialectOptions: {
      ssl: {
        require: true, 
        rejectUnauthorized: false, 
      },
    },
  },
);

sequelize
  .authenticate()
  .then(() => console.log("✅ Database terhubung ke Supabase!"))
  .catch((err) => console.error("❌ Gagal terhubung ke database:", err));

module.exports = sequelize;