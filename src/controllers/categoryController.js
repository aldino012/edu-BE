const { Category } = require('../models');

// 1. READ: Ambil Semua Kategori
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      order: [['id', 'ASC']] // Mengurutkan berdasarkan ID agar tidak berantakan
    });

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil semua kategori',
      data: categories
    });
  } catch (error) {
    console.error("Error Get All Categories:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil kategori', 
      error: error.message 
    });
  }
};

// 2. READ: Ambil Satu Kategori Berdasarkan ID (Opsional)
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    }

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil detail kategori', error: error.message });
  }
};

// 3. CREATE: Tambah Kategori Baru (Jika diperlukan untuk Admin)
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const newCategory = await Category.create({ name });
    res.status(201).json({ success: true, message: 'Kategori berhasil dibuat', data: newCategory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal menambah kategori', error: error.message });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory
};