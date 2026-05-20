const { Sequelize, Op } = require("sequelize");
const { Content, Category, Quiz } = require("../../models");

// 2. READ: Ambil 5 Soal Acak untuk Play
const getRandomPlay = async (req, res) => {
  try {
    // ==========================================
    // DINAMIS: Menentukan fungsi acak berdasarkan Dialek DB
    // ==========================================
    const randomFunction =
      process.env.DB_DIALECT === "postgres" ? "RANDOM()" : "RAND()";

    const quizzes = await Quiz.findAll({
      // Menggunakan variable randomFunction agar support MySQL & Postgres
      order: Sequelize.literal(randomFunction),
      limit: 5,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: Content,
          as: "question_details",
          attributes: [
            "id",
            "label",
            "value",
            "image_url",
            "audio_url",
            "category_id",
          ],
        },
      ],
    });

    const formattedQuizzes = await Promise.all(
      quizzes.map(async (quiz) => {
        // 1. BERSIHKAN SPASI
        const optA = quiz.option_a ? quiz.option_a.trim() : "";
        const optB = quiz.option_b ? quiz.option_b.trim() : "";
        const optC = quiz.option_c ? quiz.option_c.trim() : "";
        const optD = quiz.option_d ? quiz.option_d.trim() : "";

        const labelsToSearch = [optA, optB, optC, optD].filter(Boolean);

        // 2. AMBIL CONTENT (Optimasi: Op.in tetap aman di Postgres & MySQL)
        const relatedContents = await Content.findAll({
          where: {
            category_id: quiz.category_id,
            label: {
              [Op.in]: labelsToSearch,
            },
          },
        });

        // 3. HELPER DETAIL OPTION
        const getDetailedOption = (originalLabel) => {
          if (!originalLabel || originalLabel.trim() === "") return null;

          const cleanLabel = originalLabel.trim().toLowerCase();
          const match = relatedContents.find(
            (c) => c.label.trim().toLowerCase() === cleanLabel,
          );

          if (match) {
            return {
              id: match.id,
              label: match.label,
              value: match.value,
              image_url: match.image_url,
              audio_url: match.audio_url,
            };
          }

          return {
            id: `fallback-${cleanLabel}`,
            label: originalLabel.trim(),
            value: originalLabel.trim(),
            image_url: null,
            audio_url: null,
          };
        };

        return {
          id: quiz.id,
          category: quiz.category,
          question_text: quiz.question_text,
          // 4. SUSUN RICH CONTENT
          options: {
            a: getDetailedOption(quiz.option_a),
            b: getDetailedOption(quiz.option_b),
            c: getDetailedOption(quiz.option_c),
            d: getDetailedOption(quiz.option_d),
          },
          correctContent: quiz.question_details,
          answer_key: quiz.answer_key,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      total: formattedQuizzes.length,
      data: formattedQuizzes,
    });
  } catch (error) {
    console.error("Error getRandomPlay:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil kuis acak",
      error: error.message,
    });
  }
};

// 3. READ: Ambil Semua Soal (Admin List)
const getAllQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.findAll({
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: Content,
          as: "question_details", // Menggunakan alias dari model
          attributes: ["id", "label", "value", "category_id"],
        },
      ],
      order: [["id", "DESC"]],
    });

    // Format response untuk admin list
    const formattedQuizzes = quizzes.map((quiz) => ({
      id: quiz.id,
      category: quiz.category,
      question_text: quiz.question_text,
      options: {
        a: quiz.option_a,
        b: quiz.option_b,
        c: quiz.option_c,
        d: quiz.option_d,
      },
      correctContent: quiz.question_details, 
      answer_key: quiz.answer_key,
      createdAt: quiz.createdAt,
    }));

    res.status(200).json({ success: true, data: formattedQuizzes });
  } catch (error) {
    console.error("Error getAllQuizzes:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil semua data kuis",
      error: error.message,
    });
  }
};

// 4. READ: Ambil Satu Soal Berdasarkan ID (Untuk Form Edit Frontend)
const getQuizById = async (req, res) => {
  try {
    const { id } = req.params;

    const quiz = await Quiz.findByPk(id, {
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: Content,
          as: "question_details",
          attributes: ["id", "label", "value", "category_id"],
        },
      ],
    });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Soal tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error("Error getQuizById:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data soal",
      error: error.message,
    });
  }
};

// Export semua fungsi
module.exports = {
  getRandomPlay,
  getAllQuizzes,
  getQuizById,
};