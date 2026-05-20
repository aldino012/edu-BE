require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Content, Category } = require("../../models");
const { kamusHuruf, angkaKeTerbilang } = require("../../utils/contentHelpers");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("cross-fetch");

// =========================
// INISIALISASI SUPABASE
// =========================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

// Menambahkan cross-fetch agar stabil di Vercel/Node 18+
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetch,
  },
});

const bulkImportSamples = async (req, res) => {
  try {
    const { category_id } = req.body;

    // =========================
    // 1. CEK KATEGORI
    // =========================
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Kategori tidak ditemukan" });
    }

    const categoryName = category.name.toLowerCase();
    let type = "";
    if (categoryName.includes("angka")) type = "angka";
    else if (categoryName.includes("huruf")) type = "huruf";
    else if (categoryName.includes("warna")) type = "warna";
    else {
      return res.status(400).json({
        success: false,
        message: "Kategori ini belum didukung untuk sinkronisasi massal.",
      });
    }

    // Hanya merujuk ke folder sample (Membaca file di Vercel diperbolehkan)
    const sampleBasePath = path.join(process.cwd(), "src/sample");
    const results = [];

    // Ambil data yang sudah ada di database untuk mencegah duplikasi
    const existingContents = await Content.findAll({ where: { category_id } });
    const existingValues = existingContents.map((c) => c.value.toUpperCase());

    // =========================
    // 2. HELPER: UPLOAD KE SUPABASE
    // =========================
    const uploadToSupabase = async (sourceFilePath, folder, fileName) => {
      // Baca file sampel langsung dari source code
      const fileBuffer = fs.readFileSync(sourceFilePath);
      const filePath = `${folder}/${fileName}`;

      // Menentukan tipe konten sederhana berdasarkan ekstensi
      const ext = path.extname(fileName).toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".png") contentType = "image/png";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      if (ext === ".mp3") contentType = "audio/mpeg";

      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, fileBuffer, {
          contentType,
          upsert: true, // Menimpa file sample yang sama jika bulk import diulang
        });

      if (error) {
        console.error(`Gagal upload ${fileName} ke Supabase:`, error.message);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    };

    // =========================
    // 3. SINKRONISASI BERDASARKAN TIPE
    // =========================
    if (type === "angka") {
      const audioPath = path.join(sampleBasePath, "audio/angka");
      if (fs.existsSync(audioPath)) {
        const files = fs.readdirSync(audioPath);
        for (const file of files) {
          const value = path.parse(file).name;

          if (existingValues.includes(value.toUpperCase())) continue;

          // Langsung upload dari folder sample ke Supabase (Tanpa copy lokal)
          const sourcePath = path.join(audioPath, file);
          const supabaseAudioUrl = await uploadToSupabase(
            sourcePath,
            "audio",
            file,
          );

          results.push({
            category_id: category.id,
            value: value,
            label: angkaKeTerbilang(value),
            image_url: null,
            audio_url: supabaseAudioUrl,
          });
        }
      }
    } else if (type === "huruf") {
      const imagePath = path.join(sampleBasePath, "images/huruf");
      if (fs.existsSync(imagePath)) {
        const files = fs.readdirSync(imagePath);
        for (const file of files) {
          const char = path.parse(file).name.toUpperCase();

          if (existingValues.includes(char)) continue;

          // --- LOGIKA GAMBAR ---
          const sourceImgPath = path.join(imagePath, file);
          const supabaseImageUrl = await uploadToSupabase(
            sourceImgPath,
            "images",
            file,
          );

          // --- LOGIKA AUDIO ---
          const audioFileName = `${char.toLowerCase()}.mp3`;
          const sourceAudioPath = path.join(
            sampleBasePath,
            `audio/huruf/${audioFileName}`,
          );
          let supabaseAudioUrl = null;

          if (fs.existsSync(sourceAudioPath)) {
            supabaseAudioUrl = await uploadToSupabase(
              sourceAudioPath,
              "audio",
              audioFileName,
            );
          }

          results.push({
            category_id: category.id,
            value: char,
            label: kamusHuruf[char] || char,
            image_url: supabaseImageUrl,
            audio_url: supabaseAudioUrl,
          });
        }
      }
    } else if (type === "warna") {
      const jsonPath = path.join(sampleBasePath, "warna.json");

      if (fs.existsSync(jsonPath)) {
        const rawData = fs.readFileSync(jsonPath, "utf-8");
        const warnaData = JSON.parse(rawData);

        for (const item of warnaData) {
          if (existingValues.includes(item.value.toUpperCase())) continue;

          const audioFileName = `${item.label.toLowerCase()}.mp3`;
          const sourceAudioPath = path.join(
            sampleBasePath,
            `audio/warna/${audioFileName}`,
          );
          let supabaseAudioUrl = null;

          if (fs.existsSync(sourceAudioPath)) {
            supabaseAudioUrl = await uploadToSupabase(
              sourceAudioPath,
              "audio",
              audioFileName,
            );
          }

          results.push({
            category_id: category.id,
            value: item.value.toUpperCase(),
            label: item.label,
            image_url: null,
            audio_url: supabaseAudioUrl,
          });
        }
      } else {
        return res.status(404).json({
          success: false,
          message: "File warna.json tidak ditemukan di folder src/sample.",
        });
      }
    }

    // =========================
    // 4. INSERT MASSAL KE DB
    // =========================
    if (results.length > 0) {
      await Content.bulkCreate(results);
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil mengimpor ${results.length} materi ${type} baru (Tersimpan di Supabase Cloud).`,
      data: results,
    });
  } catch (error) {
    console.error("🔥 Error Bulk Import:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal melakukan sinkronisasi massal",
      error: error.message,
    });
  }
};

module.exports = bulkImportSamples;