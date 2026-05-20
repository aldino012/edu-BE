require("dotenv").config();
const { Content, Category } = require("../../models");
const {
  kamusHuruf,
  angkaKeTerbilang,
  isValidLetter,
  isValidNumber,
} = require("../../utils/contentHelpers");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("cross-fetch");

// =========================
// INISIALISASI SUPABASE
// =========================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Pastikan ini pakai SUPABASE_SERVICE_KEY di .env

// Menambahkan cross-fetch untuk mencegah bug "fetch failed" di Node 18+ Windows
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetch,
  },
});

const createContent = async (req, res) => {
  try {
    const { category_id, value, label, image_url, audio_url } = req.body;

    // =========================
    // CHECK CATEGORY
    // =========================
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: `Kategori dengan ID '${category_id}' tidak ditemukan.`,
      });
    }

    const finalValue = String(value).toUpperCase();
    let finalLabel = label;

    // =========================
    // DUPLIKAT CHECK PER CATEGORY
    // =========================
    const existing = await Content.findOne({
      where: {
        category_id,
        value: finalValue,
      },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Value sudah ada di kategori ini (tidak boleh duplikat)",
      });
    }

    // =========================
    // RULE: HURUF (A-Z ONLY) + AUTO LABEL
    // =========================
    if (category.name.toLowerCase().includes("huruf")) {
      if (!isValidLetter(finalValue)) {
        return res.status(400).json({
          success: false,
          message: "Huruf hanya boleh A-Z",
        });
      }

      if (!finalLabel) {
        finalLabel = kamusHuruf[finalValue] || null;
      }

      if (!finalLabel) {
        return res.status(400).json({
          success: false,
          message:
            "Label wajib diisi atau pastikan huruf valid untuk auto-label",
        });
      }
    }

    // =========================
    // RULE: ANGKA (0 - 100) + AUTO LABEL
    // =========================
    if (category.name.toLowerCase().includes("angka")) {
      if (!isValidNumber(finalValue)) {
        return res.status(400).json({
          success: false,
          message: "Angka hanya boleh 0 - 100",
        });
      }

      if (!finalLabel) {
        finalLabel = angkaKeTerbilang(finalValue);
      }
    }

    // =========================
    // UPLOAD KE SUPABASE (Memakai RAM/Buffer)
    // =========================
    let finalImageUrl = image_url || null;
    let finalAudioUrl = audio_url || null;

    // Fungsi helper menggunakan Supabase Client & file.buffer
    const uploadToSupabase = async (file, folder) => {
      // 1. Ambil file langsung dari memory (Buffer)
      const fileBuffer = file.buffer;

      // 2. Buat nama file unik menggunakan waktu saat ini agar tidak ter-overwrite
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      // Ekstrak ekstensi file aslinya (contoh: .png, .mp3, .jpg)
      const extension = file.originalname.split(".").pop();
      const filePath = `${folder}/${uniqueSuffix}.${extension}`;

      // 3. Upload buffer ke Supabase bucket 'uploads'
      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new Error(`Gagal upload ${folder} ke Supabase: ${error.message}`);
      }

      // 4. Dapatkan Public URL
      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    };

    // Jika ada gambar yang diupload
    if (req.files?.image && req.files.image.length > 0) {
      const memoryImage = req.files.image[0];
      finalImageUrl = await uploadToSupabase(memoryImage, "images");
    }

    // Jika ada audio yang diupload
    if (req.files?.audio && req.files.audio.length > 0) {
      const memoryAudio = req.files.audio[0];
      finalAudioUrl = await uploadToSupabase(memoryAudio, "audio");
    }

    // =========================
    // CREATE CONTENT
    // =========================
    const newContent = await Content.create({
      category_id: category.id,
      value: finalValue,
      label: finalLabel,
      image_url: finalImageUrl,
      audio_url: finalAudioUrl,
    });

    return res.status(201).json({
      success: true,
      message: "Materi berhasil ditambahkan (Tersimpan di Supabase Cloud)",
      data: newContent,
    });
  } catch (error) {
    console.error("Error Create Content:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambah materi",
      error: error.message,
    });
  }
};

module.exports = createContent;