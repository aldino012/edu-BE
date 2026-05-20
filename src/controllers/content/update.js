require("dotenv").config();
const { Content, Category } = require("../../models");
const {
  deleteFile, // Pastikan fungsi ini juga sudah diubah untuk menghapus file di Supabase
  isValidLetter,
  isValidNumber,
} = require("../../utils/contentHelpers");
const { createClient } = require("@supabase/supabase-js");
const fetch = require("cross-fetch");

// =========================
// INISIALISASI SUPABASE
// =========================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// PERBAIKAN: Suntikkan cross-fetch ke global fetch configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: fetch,
  },
});

const updateContent = async (req, res) => {
  try {
    const { id } = req.params;
    let { category_id, value, label, image_url, audio_url } = req.body;

    // =========================
    // SANITIZE ID (Mencegah error jika ID double dari FE)
    // =========================
    const cleanId = Number(String(id).split(",")[0]);
    const cleanCategoryId = category_id
      ? Number(String(category_id).split(",")[0])
      : null;

    // =========================
    // FIND EXISTING CONTENT
    // =========================
    const content = await Content.findByPk(cleanId);
    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Materi tidak ditemukan",
      });
    }

    // =========================
    // VALIDASI KATEGORI
    // =========================
    const category = await Category.findByPk(
      cleanCategoryId || content.category_id,
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    let finalValue = value ? String(value).toUpperCase() : content.value;

    // =========================
    // DUPLICATE CHECK
    // =========================
    if (value) {
      const duplicate = await Content.findOne({
        where: {
          category_id: category.id,
          value: finalValue,
        },
      });

      if (duplicate && duplicate.id !== content.id) {
        return res.status(400).json({
          success: false,
          message: "Value sudah digunakan di kategori ini",
        });
      }
    }

    // =========================
    // RULE VALIDASI (HURUF & ANGKA)
    // =========================
    if (category.name.toLowerCase().includes("huruf")) {
      if (value && !isValidLetter(finalValue)) {
        return res.status(400).json({
          success: false,
          message: "Huruf hanya boleh A-Z",
        });
      }
    }

    if (category.name.toLowerCase().includes("angka")) {
      if (value && !isValidNumber(finalValue)) {
        return res.status(400).json({
          success: false,
          message: "Angka hanya boleh 0 - 100",
        });
      }
      if (req.files?.image) {
        return res.status(400).json({
          success: false,
          message: "Kategori Angka tidak diperbolehkan mengunggah gambar",
        });
      }
    }

    // =========================
    // HELPER: UPLOAD KE SUPABASE (Memakai RAM/Buffer)
    // =========================
    const uploadToSupabase = async (file, folder) => {
      // 1. Ambil file langsung dari memory (Buffer)
      const fileBuffer = file.buffer;

      // 2. Buat nama file unik
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const extension = file.originalname.split(".").pop();
      const filePath = `${folder}/${uniqueSuffix}.${extension}`;

      // 3. Upload ke Supabase
      const { data, error } = await supabase.storage
        .from("uploads")
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        throw new Error(`Gagal upload ${folder} ke Supabase: ${error.message}`);
      }

      // 4. Ambil Public URL
      const { data: publicUrlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    };

    // =========================
    // LOGIKA UPDATE FILE (IMAGE & AUDIO)
    // =========================
    let newImageUrl = content.image_url;
    let newAudioUrl = content.audio_url;

    // --- PROSES GAMBAR ---
    if (req.files?.image && req.files.image.length > 0) {
      const memoryImage = req.files.image[0];

      // Upload ke Supabase
      const uploadedImageUrl = await uploadToSupabase(memoryImage, "images");

      // HAPUS FILE LAMA DARI SUPABASE
      if (content.image_url) {
        await deleteFile(content.image_url);
      }

      newImageUrl = uploadedImageUrl;
    } else if (image_url === "" || image_url === null) {
      // Jika FE mengirim instruksi hapus gambar
      if (content.image_url) {
        await deleteFile(content.image_url);
      }
      newImageUrl = null;
    }

    // --- PROSES AUDIO ---
    if (req.files?.audio && req.files.audio.length > 0) {
      const memoryAudio = req.files.audio[0];

      // Upload ke Supabase
      const uploadedAudioUrl = await uploadToSupabase(memoryAudio, "audio");

      // HAPUS FILE LAMA DARI SUPABASE
      if (content.audio_url) {
        await deleteFile(content.audio_url);
      }

      newAudioUrl = uploadedAudioUrl;
    } else if (audio_url === "" || audio_url === null) {
      // Jika FE mengirim instruksi hapus audio
      if (content.audio_url) {
        await deleteFile(content.audio_url);
      }
      newAudioUrl = null;
    }

    // =========================
    // EKSEKUSI UPDATE KE DATABASE
    // =========================
    await content.update({
      category_id: category.id,
      value: finalValue,
      label: label || content.label,
      image_url: newImageUrl,
      audio_url: newAudioUrl,
    });

    return res.status(200).json({
      success: true,
      message: "Materi berhasil diperbarui",
      data: content,
    });
  } catch (error) {
    console.error("🔥 Error Update Content:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengupdate materi",
      error: error.message,
    });
  }
};

module.exports = updateContent;