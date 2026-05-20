const express = require("express");
const router = express.Router();
const multer = require("multer");
const contentController = require("../controllers/contentController");

// 1. Middleware Auth Admin
const requireAdmin = require("../middlewares/authMiddleware");

// 2. FIXED: Gunakan Memory Storage untuk Vercel & Supabase
// Kita tidak lagi menggunakan fs atau path untuk membuat folder lokal
const storage = multer.memoryStorage();

// 3. File filter (Keamanan agar tipe file sesuai)
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "image") {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("File image harus berupa gambar"), false);
    }
  }

  if (file.fieldname === "audio") {
    if (!file.mimetype.startsWith("audio/")) {
      return cb(new Error("File audio harus berupa audio"), false);
    }
  }

  cb(null, true);
};

// 4. Upload config
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// 5. Multi field upload
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

// =======================
// PUBLIC ROUTES
// =======================

router.get("/", contentController.getAllContents);

router.get("/:id", contentController.getContentById);

// =======================
// ADMIN ROUTES
// =======================

// ENDPOINT BULK IMPORT (Diletakkan di atas agar tidak terbaca sebagai /:id)
router.post("/bulk-import", requireAdmin, contentController.bulkImportSamples);

router.post("/", requireAdmin, uploadFields, contentController.createContent);

router.put("/:id", requireAdmin, uploadFields, contentController.updateContent);

router.delete("/:id", requireAdmin, contentController.deleteContent);

module.exports = router;
