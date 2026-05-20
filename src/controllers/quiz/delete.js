const { Quiz } = require("../../models");

// =========================
// DELETE: Hapus Soal Kuis
// =========================
const deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;

    // Gunakan destroy dengan klausa where untuk langsung menghapus
    // result akan berisi angka jumlah baris yang terhapus (0 jika tidak ada)
    const result = await Quiz.destroy({
      where: { id },
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Soal kuis tidak ditemukan atau sudah terhapus",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Soal kuis berhasil dihapus selamanya",
    });
  } catch (error) {
    console.error("🔥 Error Delete Quiz:", error);

    return res.status(500).json({
      success: false,
      message: "Gagal menghapus soal kuis",
      error: error.message,
    });
  }
};

module.exports = deleteQuiz;