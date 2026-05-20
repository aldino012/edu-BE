const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

// 1. Import Middleware Autentikasi
const requireAdmin = require('../middlewares/authMiddleware');

// --- Rute (Endpoints) Game (Publik - Tidak Perlu Token) ---

/**
 * @route   GET /api/quizzes/play
 * @desc    Mengambil 5 soal kuis secara acak dari Bank Soal (beserta media gambar/audio)
 */
router.get('/play', quizController.getRandomPlay);


// --- Rute (Endpoints) Bank Soal (Admin - Wajib Token) ---

/**
 * @route   POST /api/quizzes
 * @desc    Admin: Menambah soal baru ke dalam Bank Soal
 */
router.post('/', requireAdmin, quizController.createQuiz);

/**
 * @route   GET /api/quizzes
 * @desc    Admin: Melihat semua daftar soal yang ada di Bank Soal
 */
router.get('/', requireAdmin, quizController.getAllQuizzes);

/**
 * @route   GET /api/quizzes/:id
 * @desc    Admin: Mengambil satu soal kuis berdasarkan ID (Untuk keperluan Form Edit)
 */
router.get('/:id', requireAdmin, quizController.getQuizById);

/**
 * @route   PUT /api/quizzes/:id
 * @desc    Admin: Memperbarui data soal kuis berdasarkan ID
 */
router.put('/:id', requireAdmin, quizController.updateQuiz);

/**
 * @route   DELETE /api/quizzes/:id
 * @desc    Admin: Menghapus soal kuis dari database
 */
router.delete('/:id', requireAdmin, quizController.deleteQuiz);

module.exports = router;