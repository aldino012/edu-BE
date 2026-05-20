const { Content, Category } = require("../../models");

// READ: Ambil Semua Materi
const getAllContents = async (req, res) => {
  try {
    const { category_id } = req.query;
    const whereCondition = {};

    if (category_id) {
      whereCondition.category_id = category_id;
    }

    const contents = await Content.findAll({
      where: whereCondition,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["name"],
        },
      ],
      order: [["id", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: contents.length,
      data: contents,
    });
  } catch (error) {
    console.error("Error Get All Contents:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data materi",
      error: error.message,
    });
  }
};

// READ: Ambil Materi Berdasarkan ID
const getContentById = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await Content.findByPk(id, {
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["name"],
        },
      ],
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Materi tidak ditemukan",
      });
    }

    res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Error Get Content By ID:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data materi",
      error: error.message,
    });
  }
};

module.exports = {
  getAllContents,
  getContentById,
};