const express = require("express");
const router = express.Router();
const partgameController = require("../controllers/partgame");
const { authMiddleware } = require("../middlewares/authMiddleware");

// Routes untuk fitur "Ayo Membaca" (Reading Game)
// GET /api/partgame/read - Mendapatkan semua konten membaca dengan pemenggalan kata
router.get("/read", partgameController.getReadingContent);

// GET /api/partgame/read/:id - Mendapatkan detail satu kata dengan pemenggalan
router.get("/read/:id", partgameController.getReadingDetail);

// Routes untuk fitur lainnya (akan ditambahkan nanti)
// GET /api/partgame/numbers - Untuk fitur Mengenal Angka
// router.get('/numbers', partgameController.getNumberContent);

// GET /api/partgame/colors - Untuk fitur Mengenal Warna
// router.get('/colors', partgameController.getColorContent);

module.exports = router;
