const { supabaseAdmin } = require("../config/supabase");
const crypto = require("crypto");

// ==========================================
// IN-MEMORY CACHE untuk pending 2FA sessions
// ==========================================
const pendingTwoFactorSessions = new Map();

// Cleanup expired sessions setiap 10 menit
setInterval(
  () => {
    const now = Date.now();
    for (const [key, session] of pendingTwoFactorSessions.entries()) {
      if (session.expiresAt < now) {
        pendingTwoFactorSessions.delete(key);
        console.log(`🧹 Cleaned up expired 2FA session: ${key}`);
      }
    }
  },
  10 * 60 * 1000,
);

// Export untuk digunakan di twoFactorController
const getPendingSession = (tempId) => pendingTwoFactorSessions.get(tempId);
const deletePendingSession = (tempId) =>
  pendingTwoFactorSessions.delete(tempId);

// ✅ Helper function untuk validasi super_admin
const checkSuperAdmin = async (userId) => {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { error: "Profil user tidak ditemukan" };
  }

  if (profile.role !== "super_admin") {
    return { error: "Akses ditolak. Fitur ini hanya untuk super admin." };
  }

  return { success: true };
};

/**
 * ✅ BARU: Auto-delete rejected users older than 1 hour
 */
const cleanupRejectedUsers = async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    console.log(`🔍 Checking for rejected users older than ${oneHourAgo}...`);

    const { data: rejectedUsers, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, updated_at")
      .eq("role", "pending_admin")
      .eq("is_approved", false)
      .not("rejection_reason", "is", null)
      .lt("updated_at", oneHourAgo);

    if (fetchError) {
      console.error("❌ Error fetching rejected users:", fetchError);
      return { success: false, deleted: 0 };
    }

    if (!rejectedUsers || rejectedUsers.length === 0) {
      console.log("✅ No rejected users to cleanup");
      return { success: true, deleted: 0 };
    }

    console.log(
      `🗑️ Found ${rejectedUsers.length} rejected users to cleanup...`,
    );

    let deletedCount = 0;
    let failedCount = 0;

    for (const user of rejectedUsers) {
      try {
        const { error: deleteProfileError } = await supabaseAdmin
          .from("profiles")
          .delete()
          .eq("id", user.id);

        if (deleteProfileError) {
          console.error(
            `❌ Failed to delete profile for ${user.full_name}:`,
            deleteProfileError,
          );
          failedCount++;
          continue;
        }

        const { error: deleteUserError } =
          await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteUserError) {
          console.error(
            `⚠️ Profile deleted but failed to delete auth user for ${user.full_name}:`,
            deleteUserError,
          );
          deletedCount++;
          continue;
        }

        console.log(`✅ Deleted rejected user: ${user.full_name} (${user.id})`);
        deletedCount++;
      } catch (err) {
        console.error(`❌ Error deleting user ${user.id}:`, err);
        failedCount++;
      }
    }

    console.log(
      `✅ Cleanup completed: ${deletedCount} deleted, ${failedCount} failed`,
    );

    return { success: true, deleted: deletedCount, failed: failedCount };
  } catch (error) {
    console.error("❌ Cleanup rejected users error:", error);
    return { success: false, deleted: 0 };
  }
};

// ✅ Jalankan cleanup setiap 15 menit secara otomatis
setInterval(
  () => {
    console.log("🔄 Running scheduled cleanup of rejected users...");
    cleanupRejectedUsers();
  },
  15 * 60 * 1000,
);

/**
 * Register user baru sebagai pending admin
 */
const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    console.log("🔍 Register attempt:", { email, full_name });

    if (!email || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: "Email, password, dan nama lengkap wajib diisi",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid. Gunakan format: user@domain.com",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter",
      });
    }

    if (full_name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Nama lengkap minimal 3 karakter",
      });
    }

    const { data: existingUsers, error: checkError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (checkError) {
      console.error("Error checking existing users:", checkError);
    } else {
      const emailExists = existingUsers?.users?.some(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      );

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message:
            "Email sudah terdaftar. Silakan gunakan email lain atau login.",
        });
      }
    }

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(400).json({
        success: false,
        message: authError.message || "Gagal membuat user",
      });
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    return res.status(201).json({
      success: true,
      message: "Registrasi berhasil! Menunggu konfirmasi dari super admin.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Login user - dengan dukungan 2FA untuk super admin
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔍 Login attempt:", {
      email,
      passwordLength: password?.length,
    });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi",
      });
    }

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    console.log("🔍 Supabase response:", {
      hasError: !!error,
      errorMessage: error?.message,
      hasUser: !!data?.user,
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: error.message || "Email atau password salah",
      });
    }

    const { user, session } = data;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select(
        "role, is_approved, full_name, two_factor_enabled, two_factor_secret",
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        message: "Profil user tidak ditemukan di database.",
      });
    }

    if (profile.role === "pending_admin" && !profile.is_approved) {
      return res.status(403).json({
        success: false,
        message: "Akun Anda sedang menunggu konfirmasi dari super admin.",
      });
    }

    const isSuperAdmin = profile.role === "super_admin";
    const twoFactorEnabled =
      profile.two_factor_enabled && profile.two_factor_secret;

    if (isSuperAdmin && twoFactorEnabled) {
      const tempId = crypto.randomUUID();

      pendingTwoFactorSessions.set(tempId, {
        userId: user.id,
        email: user.email,
        password: password,
        full_name: profile.full_name,
        role: profile.role,
        two_factor_secret: profile.two_factor_secret,
        createdAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      console.log(
        `🔐 2FA required for super admin: ${email}, tempId: ${tempId}`,
      );

      return res.status(200).json({
        success: true,
        need_2fa: true,
        temp_id: tempId,
        message: "2FA aktif. Silakan masukkan kode dari Google Authenticator.",
        user: {
          id: user.id,
          email: user.email,
          full_name: profile.full_name,
          role: profile.role,
        },
      });
    }

    return res.status(200).json({
      success: true,
      need_2fa: false,
      message: "Login berhasil",
      token: session.access_token,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile.full_name,
        role: profile.role,
        is_approved: profile.is_approved,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Get semua pending admins (untuk super admin)
 */
const getPendingAdmins = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const cleanupResult = await cleanupRejectedUsers();
    if (cleanupResult.deleted > 0) {
      console.log(`🧹 Auto-cleaned ${cleanupResult.deleted} rejected users`);
    }

    const { data: profiles, error } = await req.supabase
      .from("profiles")
      .select(
        "id, full_name, role, is_approved, rejection_reason, created_at, updated_at",
      )
      .eq("role", "pending_admin")
      .eq("is_approved", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Get Pending Admins Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        message: "Tidak ada pending admin",
      });
    }

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = require("../config/supabase");
    const { createClient } = require("@supabase/supabase-js");
    const supabaseAdminLocal = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const profilesWithEmail = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const { data: userData, error: userError } =
            await supabaseAdminLocal.auth.admin.getUserById(profile.id);

          if (userError) {
            console.warn(
              `⚠️ Failed to get user data for ${profile.id}:`,
              userError,
            );
          }

          return {
            ...profile,
            email: userData?.user?.email || "N/A",
            rejection_reason: profile.rejection_reason || null,
          };
        } catch (err) {
          console.error(`Error processing profile ${profile.id}:`, err);
          return {
            ...profile,
            email: "N/A",
            rejection_reason: profile.rejection_reason || null,
          };
        }
      }),
    );

    console.log(`✅ Retrieved ${profilesWithEmail.length} pending admins`);

    return res.status(200).json({
      success: true,
      data: profilesWithEmail,
      count: profilesWithEmail.length,
    });
  } catch (error) {
    console.error("Get Pending Admins Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * ✅ BARU: Get semua approved admins (untuk super admin)
 */
const getApprovedAdmins = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { data: profiles, error } = await req.supabase
      .from("profiles")
      .select("id, full_name, role, is_approved, created_at, updated_at")
      .eq("role", "admin")
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Get Approved Admins Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        message: "Tidak ada admin yang disetujui",
      });
    }

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    } = require("../config/supabase");
    const { createClient } = require("@supabase/supabase-js");
    const supabaseAdminLocal = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    );

    const profilesWithEmail = await Promise.all(
      profiles.map(async (profile) => {
        try {
          const { data: userData, error: userError } =
            await supabaseAdminLocal.auth.admin.getUserById(profile.id);

          if (userError) {
            console.warn(
              `⚠️ Failed to get user data for ${profile.id}:`,
              userError,
            );
          }

          return {
            ...profile,
            email: userData?.user?.email || "N/A",
          };
        } catch (err) {
          console.error(`Error processing profile ${profile.id}:`, err);
          return {
            ...profile,
            email: "N/A",
          };
        }
      }),
    );

    console.log(`✅ Retrieved ${profilesWithEmail.length} approved admins`);

    return res.status(200).json({
      success: true,
      data: profilesWithEmail,
      count: profilesWithEmail.length,
    });
  } catch (error) {
    console.error("Get Approved Admins Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Approve admin (untuk super admin)
 */
const approveAdmin = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { userId } = req.params;

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "admin",
        is_approved: true,
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Admin ${profile.full_name} berhasil disetujui`,
    });
  } catch (error) {
    console.error("Approve Admin Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Reject admin (untuk super admin)
 */
const rejectAdmin = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { userId } = req.params;
    const { reason } = req.body;

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        is_approved: false,
        rejection_reason: reason || "Tidak ada alasan",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return res.status(400).json({
        success: false,
        message: updateError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Admin ${profile.full_name} ditolak`,
    });
  } catch (error) {
    console.error("Reject Admin Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * ✅ BARU: Delete admin (untuk super admin)
 */
const deleteAdmin = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { userId } = req.params;
    const requesterId = req.user.id;

    if (userId === requesterId) {
      return res.status(400).json({
        success: false,
        message: "Anda tidak dapat menghapus akun Anda sendiri",
      });
    }

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (profile.role === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Tidak dapat menghapus super admin lain",
      });
    }

    const { error: deleteProfileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (deleteProfileError) {
      console.error("Error deleting profile:", deleteProfileError);
      return res.status(400).json({
        success: false,
        message: "Gagal menghapus profil: " + deleteProfileError.message,
      });
    }

    const { error: deleteUserError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error("Error deleting auth user:", deleteUserError);
      return res.status(207).json({
        success: true,
        message: `Profil ${profile.full_name} berhasil dihapus, namun gagal menghapus akun autentikasi`,
        warning: deleteUserError.message,
      });
    }

    console.log(`✅ Admin deleted: ${profile.full_name} (${userId})`);

    return res.status(200).json({
      success: true,
      message: `Admin ${profile.full_name} berhasil dihapus`,
    });
  } catch (error) {
    console.error("Delete Admin Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logout berhasil",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    console.error("Get Current User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server",
    });
  }
};

// ==========================================
// ✅ FITUR BARU: RESET PASSWORD
// ==========================================

/**
 * 1. Request password reset (Lupa Password)
 * Mengirimkan email berisi link reset password ke user
 */
// Cari fungsi requestPasswordReset di authController.js
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email wajib diisi" });
    }

    // ✅ PERBAIKAN: Arahkan ke URL FRONTEND (Vite port 5173), BUKAN backend (3000)
    const redirectTo = "http://localhost:5173/admin/reset-password"; 

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo,
    });

    if (error) {
      console.error("❌ Reset Password Email Error:", error); // Cek terminal jika ada error
    }

    return res.status(200).json({
      success: true,
      message: "Jika email terdaftar, link reset password telah dikirim.",
    });
  } catch (error) {
    console.error("Request Password Reset Error:", error);
    return res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
  }
};

/**
 * 2. Update password setelah user klik link dari email
 * Endpoint ini harus dipanggil saat user sudah ter-autentikasi dengan recovery token
 * (Frontend akan menangkap token dari URL, membuat session, lalu mengirim request ke endpoint ini)
 */
const resetPassword = async (req, res) => {
  try {
    // req.user harus ada dari middleware autentikasi (karena user harus login via recovery token)
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message:
          "Sesi tidak valid atau token reset password sudah kedaluwarsa. Silakan minta link reset password baru.",
      });
    }

    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: "Password baru wajib diisi",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter",
      });
    }

    // Update password menggunakan supabaseAdmin
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user.id,
      {
        password: new_password,
      },
    );

    if (error) {
      console.error("Update Password Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Gagal memperbarui password",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Password berhasil diperbarui. Silakan login dengan password baru Anda.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

/**
 * 3. ✅ BONUS: Admin reset password (untuk super admin)
 * Mengubah password user secara langsung tanpa email (opsional)
 */
const adminResetPassword = async (req, res) => {
  try {
    const validation = await checkSuperAdmin(req.user.id);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { userId } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru wajib diisi dan minimal 6 karakter",
      });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: new_password,
    });

    if (error) {
      console.error("Admin Reset Password Error:", error);
      return res.status(400).json({
        success: false,
        message: error.message || "Gagal mereset password user",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Password user berhasil direset oleh admin",
    });
  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Terjadi kesalahan pada server",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  getPendingAdmins,
  getApprovedAdmins,
  approveAdmin,
  rejectAdmin,
  deleteAdmin,
  cleanupRejectedUsers,
  getPendingSession,
  deletePendingSession,
  // ✅ Export fitur baru
  requestPasswordReset,
  resetPassword,
  adminResetPassword,
};
