const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const twoFactorController = require("../controllers/twoFactorController");
const requireAdmin = require("../middlewares/authMiddleware");

// ==========================================
// PUBLIC ROUTES (Tidak perlu autentikasi)
// ==========================================
router.post("/register", authController.register);
router.post("/login", authController.login);

// 2FA verify saat login (public, karena user belum login)
router.post("/2fa/verify", twoFactorController.verifyCode);

// ==========================================
// PROTECTED ROUTES (Butuh autentikasi admin)
// ==========================================
router.post("/logout", requireAdmin, authController.logout);
router.get("/me", requireAdmin, authController.getCurrentUser);

// ==========================================
// SUPER ADMIN ROUTES (untuk manage admins)
// ==========================================

// Get pending admins (termasuk yang sudah di-reject)
router.get("/pending-admins", requireAdmin, authController.getPendingAdmins);

// ✅ BARU: Get approved admins (admin yang sudah aktif)
router.get("/approved-admins", requireAdmin, authController.getApprovedAdmins);

// Approve admin
router.put("/approve-admin/:userId", requireAdmin, authController.approveAdmin);

// Reject admin
router.put("/reject-admin/:userId", requireAdmin, authController.rejectAdmin);

// ✅ BARU: Delete admin (hapus permanen)
router.delete(
  "/delete-admin/:userId",
  requireAdmin,
  authController.deleteAdmin,
);

// ==========================================
// 2FA MANAGEMENT ROUTES (Protected)
// ==========================================
router.get("/2fa/status", requireAdmin, twoFactorController.getStatus);
router.post("/2fa/setup", requireAdmin, twoFactorController.setup);
router.post("/2fa/verify-setup", requireAdmin, twoFactorController.verifySetup);
router.post("/2fa/disable", requireAdmin, twoFactorController.disable);

module.exports = router;