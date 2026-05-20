const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

/**
 * @route   GET /api/categories
 * @desc    Ambil semua daftar kategori (digunakan FE untuk dropdown)
 */
router.get('/', categoryController.getAllCategories);

/**
 * @route   GET /api/categories/:id
 * @desc    Ambil detail satu kategori berdasarkan ID
 */
router.get('/:id', categoryController.getCategoryById);

/**
 * @route   POST /api/categories
 * @desc    Tambah kategori baru (Admin)
 */
router.post('/', categoryController.createCategory);

/**
 * @route   PUT /api/categories/:id
 * @desc    Update nama kategori
 */
// router.put('/:id', categoryController.updateCategory); // Aktifkan jika sudah buat fungsi update

/**
 * @route   DELETE /api/categories/:id
 * @desc    Hapus kategori
 */
// router.delete('/:id', categoryController.deleteCategory); // Aktifkan jika sudah buat fungsi delete

module.exports = router;