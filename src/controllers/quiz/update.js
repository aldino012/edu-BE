const { Content, Category, Quiz } = require("../../models");
const { determineAnswerKey } = require("../../utils/quizHelpers");

// 4. UPDATE: Edit Soal Kuis
const updateQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      correct_id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
    } = req.body;

    // =========================
    // 1. CARI DATA KUIS
    // =========================
    const quiz = await Quiz.findByPk(id);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Soal tidak ditemukan",
      });
    }

    // =========================
    // 2. VALIDASI KATEGORI & KONTEN (Jika ada perubahan)
    // =========================
    const finalCategoryId = category_id || quiz.category_id;
    const finalCorrectId = correct_id || quiz.correct_id;

    let correctContent = null;

    // Cari konten baru (atau lama jika tidak diubah) untuk validasi dan penentuan kunci
    correctContent = await Content.findByPk(finalCorrectId);

    if (!correctContent) {
      return res.status(404).json({
        success: false,
        message: "Konten jawaban referensi tidak ditemukan",
      });
    }

    if (correctContent.category_id !== parseInt(finalCategoryId)) {
      return res.status(400).json({
        success: false,
        message: "Kategori konten jawaban tidak sesuai dengan kategori soal",
      });
    }

    // =========================
    // 3. HITUNG ULANG KUNCI JAWABAN
    // =========================
    const opa = option_a || quiz.option_a;
    const opb = option_b || quiz.option_b;
    const opc = option_c || quiz.option_c;
    const opd = option_d || quiz.option_d;

    // Menggunakan helper dari utils untuk update kunci
    const updatedAnswerKey = determineAnswerKey(correctContent.label, {
      a: opa,
      b: opb,
      c: opc,
      d: opd,
    });

    if (!updatedAnswerKey) {
      return res.status(400).json({
        success: false,
        message:
          "Pembaruan gagal: Kunci jawaban harus cocok dengan salah satu teks di Opsi A, B, C, atau D yang baru",
      });
    }

    // =========================
    // 4. EKSEKUSI UPDATE
    // =========================
    await quiz.update({
      category_id: finalCategoryId,
      correct_id: finalCorrectId,
      question_text: question_text || quiz.question_text,
      option_a: opa,
      option_b: opb,
      option_c: opc,
      option_d: opd,
      answer_key: updatedAnswerKey,
    });

    // =========================
    // 5. FETCH DATA TERBARU UNTUK RESPONSE
    // =========================
    const updatedQuiz = await Quiz.findByPk(id, {
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
        {
          model: Content,
          as: "question_details",
          attributes: ["id", "label", "value", "category_id"],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Soal kuis berhasil diperbarui",
      data: updatedQuiz,
    });
  } catch (error) {
    console.error("🔥 Error Update Quiz:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui soal",
      error: error.message,
    });
  }
};

module.exports = updateQuiz;