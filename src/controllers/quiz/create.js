const { Content, Category, Quiz } = require("../../models");
const { determineAnswerKey } = require("../../utils/quizHelpers");

// 1. CREATE: Tambah Soal Kuis Baru
const createQuiz = async (req, res) => {
  try {
    const {
      category_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_id,
    } = req.body;

    // =========================
    // VALIDASI KATEGORI
    // =========================
    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan",
      });
    }

    // =========================
    // VALIDASI KONTEN JAWABAN
    // =========================
    const correctContent = await Content.findByPk(correct_id);
    if (!correctContent) {
      return res.status(400).json({
        success: false,
        message: "Konten jawaban tidak ditemukan",
      });
    }

    // Validasi: Apakah konten jawaban memiliki kategori yang sama dengan soal?
    if (correctContent.category_id !== parseInt(category_id)) {
      return res.status(400).json({
        success: false,
        message:
          "Kategori jawaban tidak cocok dengan kategori soal yang dipilih",
      });
    }

    // =========================
    // TENTUKAN KUNCI JAWABAN
    // =========================
    const answer_key = determineAnswerKey(correctContent.label, {
      a: option_a,
      b: option_b,
      c: option_c,
      d: option_d,
    });

    if (!answer_key) {
      return res.status(400).json({
        success: false,
        message:
          "Kunci jawaban harus cocok dengan salah satu teks di Opsi A, B, C, atau D",
      });
    }

    // =========================
    // EKSEKUSI CREATE
    // =========================
    const newQuiz = await Quiz.create({
      category_id,
      correct_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      answer_key,
    });

    return res.status(201).json({
      success: true,
      message: "Soal kuis berhasil ditambahkan",
      data: newQuiz,
    });
  } catch (error) {
    console.error("🔥 Error Create Quiz:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menambah soal",
      error: error.message,
    });
  }
};

module.exports = createQuiz;