require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const fetch = require("cross-fetch");

// ==========================================
// INISIALISASI SUPABASE
// ==========================================
const supabaseUrl = process.env.SUPABASE_URL;
// Gunakan Service Key agar memiliki akses penuh untuk menghapus file
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// Menambahkan cross-fetch untuk mencegah bug "fetch failed" di Node 18+ Windows/Vercel
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetch,
  },
});

/**
 * Helper function untuk menghapus file di Supabase Cloud Storage.
 * Fungsi ini mengonversi Public URL menjadi Storage Path.
 */
const deleteFile = async (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== "string") return;

  try {
    // Memisahkan URL berdasarkan kata kunci '/uploads/'
    // Contoh URL Supabase: https://[PROJECT_REF].supabase.co/storage/v1/object/public/uploads/images/12345.png
    const urlParts = fileUrl.split("/uploads/");

    if (urlParts.length < 2) {
      console.log(`⚠️ Format URL tidak dikenali untuk dihapus: ${fileUrl}`);
      return;
    }

    // Mengambil bagian setelah '/uploads/' -> contoh: 'images/12345.png'
    const relativePath = urlParts[urlParts.length - 1];

    // =========================
    // HAPUS DARI SUPABASE
    // =========================
    const { error } = await supabase.storage
      .from("uploads") // Nama bucket kamu
      .remove([relativePath]);

    if (error) {
      console.error(
        `❌ Gagal menghapus dari Supabase (${relativePath}):`,
        error.message,
      );
    } else {
      console.log(`✅ Berhasil menghapus file dari Supabase: ${relativePath}`);
    }

    // CATATAN: Logika penghapusan lokal (fs.unlinkSync) telah dihapus sepenuhnya
    // karena Vercel menggunakan Read-Only Filesystem dan file fisik tidak lagi disimpan di repo.
  } catch (error) {
    console.error(
      "❌ Terjadi kesalahan saat mengeksekusi penghapusan file:",
      error.message,
    );
  }
};

/**
 * Helper: validasi huruf A-Z
 */
const isValidLetter = (value) => {
  return /^[A-Z]$/.test(value);
};

/**
 * Helper: validasi angka 0 - 100
 */
const isValidNumber = (value) => {
  const num = Number(value);
  return Number.isInteger(num) && num >= 0 && num <= 100;
};

// ==========================================
// KAMUS & KONVERSI DATA
// ==========================================

const kamusHuruf = {
  A: "Ayam",
  B: "Babi",
  C: "Cicak",
  D: "Domba",
  E: "Elang",
  F: "Flaminggo",
  G: "Gajah",
  H: "Harimau",
  I: "Itik",
  J: "Jerapah",
  K: "Kucing",
  L: "Lebah",
  M: "Monyet",
  N: "Naga",
  O: "Orang Utan",
  P: "Pinguin",
  Q: "Quran",
  R: "Rubah",
  S: "Sapi",
  T: "T-Rex",
  U: "Ular",
  V: "Violin",
  W: "Wortel",
  X: "Xesophone",
  Y: "Yuyu",
  Z: "Zebra",
};

/**
 * Helper: Mengubah angka 0-100 menjadi teks terbilang Bahasa Indonesia
 */
const angkaKeTerbilang = (n) => {
  const satuan = [
    "Nol",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];
  const num = parseInt(n);

  if (isNaN(num)) return n;
  if (num <= 11) return satuan[num];
  if (num < 20) return angkaKeTerbilang(num % 10) + " Belas";
  if (num < 100) {
    const hasilPuluhan = satuan[Math.floor(num / 10)] + " Puluh";
    const sisa = num % 10;
    return sisa !== 0 ? hasilPuluhan + " " + satuan[sisa] : hasilPuluhan;
  }
  if (num === 100) return "Seratus";

  return n.toString();
};

module.exports = {
  deleteFile,
  isValidLetter,
  isValidNumber,
  kamusHuruf,
  angkaKeTerbilang,
};
