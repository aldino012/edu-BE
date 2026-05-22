require("dns").setDefaultResultOrder("ipv4first");
const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Tambahkan impor Category dari models
const { sequelize, Category } = require("./src/models");

const contentRoutes = require("./src/routes/contentRoutes");
const quizRoutes = require("./src/routes/quizRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://localhost:8080", // Tambahan izin untuk Nginx/Docker Frontend
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));

app.use("/api/contents", contentRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/categories", categoryRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: `Backend Edukasi Aktif (${(process.env.DB_DIALECT || "unknown").toUpperCase()} Environment) 🚀`,
  });
});

app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server",
  });
});

// --- SEEDER KATEGORI ---
const seedDefaultCategories = async () => {
  try {
    const count = await Category.count();

    if (count === 0) {
      console.log("⏳ Tabel categories kosong. Menambahkan data default...");
      await Category.bulkCreate([
        { name: "Angka" },
        { name: "Huruf" },
        { name: "Warna" },
      ]);
      console.log(
        "✅ Data default categories (Angka, Huruf, Warna) berhasil ditambahkan!",
      );
    } else {
      console.log(
        `ℹ️ Tabel categories sudah berisi ${count} data. Skip inisialisasi default.`,
      );
    }
  } catch (error) {
    console.error(
      "❌ Gagal mengecek/menambahkan data default categories:",
      error.message,
    );
  }
};

// --- FUNGSI START SERVER (UNTUK LOKAL) ---
const startServer = async () => {
  try {
    const dbType = (process.env.DB_DIALECT || "unknown").toUpperCase();
    console.log(`⏳ Langkah 1: Mencoba koneksi ke ${dbType}...`);

    await sequelize.authenticate();
    console.log(`✅ Database ${dbType} terhubung.`);

    console.log("⏳ Melakukan sinkronisasi tabel database...");
    await sequelize.sync({ alter: true });
    console.log("✅ Semua tabel berhasil dibuat/diperbarui!");

    await seedDefaultCategories();

    console.log("⏳ Langkah 2: Menyalakan port server...");
    app.listen(PORT, "0.0.0.0", () => {
      console.log("-----------------------------------------------");
      console.log(
        `🚀 SERVER BERHASIL JALAN DI PORT ${PORT}! (Mendengarkan di 0.0.0.0)`,
      );
      console.log(`📡 Dialek DB: ${process.env.DB_DIALECT}`);
      console.log("-----------------------------------------------");
    });
  } catch (error) {
    console.error("❌ Gagal memulai server:", error.message);
    if (error.original) {
      console.error(
        "Detail DB:",
        error.original.sqlMessage || error.original.detail || error.original,
      );
    }
    process.exit(1);
  }
};

// --- LOGIKA PEMISAH LOKAL & VERCEL ---
const isVercel = process.env.VERCEL === "1";

if (!isVercel) {
  // Jika di laptop sendiri, jalankan server dan sync database otomatis
  startServer();
}

// Ekspor app Express untuk dibaca oleh serverless Vercel
module.exports = app;