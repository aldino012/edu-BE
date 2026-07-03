// Import dengan cara yang kompatibel
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const { supabaseAdmin } = require("../config/supabase");
const { getPendingSession, deletePendingSession } = require("./authController");

// ✅ BARU: Helper function untuk validasi super_admin
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
    return { error: "Akses ditolak. Fitur 2FA hanya untuk super admin." };
  }

  return { success: true };
};

/**
 * Setup 2FA - Generate secret key dan QR code
 * Endpoint: POST /api/auth/2fa/setup
 */
const setup = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // ✅ Validasi: Hanya super_admin
    const validation = await checkSuperAdmin(userId);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    console.log("🔐 Setup 2FA for super admin:", userEmail);

    // Generate secret key baru
    const secret = authenticator.generateSecret();
    console.log("✅ Secret generated:", secret.substring(0, 10) + "...");

    // Buat URL untuk QR code
    const appName = "EduApp Admin";
    const otpauthUrl = authenticator.keyuri(userEmail, appName, secret);

    // Generate QR code sebagai data URL (base64)
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Simpan secret ke database (belum diaktifkan)
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_secret: secret,
        two_factor_enabled: false,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error saving 2FA secret:", updateError);
      return res.status(500).json({
        success: false,
        message: "Gagal menyimpan konfigurasi 2FA",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "QR code berhasil di-generate. Silakan scan dengan Google Authenticator.",
      data: {
        qrCode,
        secret,
      },
    });
  } catch (error) {
    console.error("Setup 2FA Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat setup 2FA: " + error.message,
    });
  }
};

/**
 * Verify Setup - Verifikasi bahwa user sudah scan QR dan bisa generate code
 * Endpoint: POST /api/auth/2fa/verify-setup
 */
const verifySetup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Kode verifikasi wajib diisi",
      });
    }

    // ✅ Validasi: Hanya super_admin
    const validation = await checkSuperAdmin(userId);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    // Ambil secret dari database
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_secret")
      .eq("id", userId)
      .single();

    if (fetchError || !profile || !profile.two_factor_secret) {
      return res.status(400).json({
        success: false,
        message:
          "Setup 2FA belum dilakukan. Silakan lakukan setup terlebih dahulu.",
      });
    }

    // Verifikasi code dengan secret
    const isValid = authenticator.verify({
      token: code,
      secret: profile.two_factor_secret,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Kode verifikasi tidak valid. Silakan coba lagi.",
      });
    }

    // Jika valid, aktifkan 2FA
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_enabled: true,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error enabling 2FA:", updateError);
      return res.status(500).json({
        success: false,
        message: "Gagal mengaktifkan 2FA",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "2FA berhasil diaktifkan! Sekarang setiap login Anda perlu memasukkan kode dari Google Authenticator.",
    });
  } catch (error) {
    console.error("Verify Setup 2FA Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat verifikasi setup 2FA",
    });
  }
};

/**
 * Verify Code - Verifikasi TOTP code saat login (STEP 2)
 * Endpoint: POST /api/auth/2fa/verify
 */
const verifyCode = async (req, res) => {
  try {
    const { temp_id, code } = req.body;

    if (!temp_id || !code) {
      return res.status(400).json({
        success: false,
        message: "Temp ID dan kode verifikasi wajib diisi",
      });
    }

    // Ambil pending session dari cache
    const session = getPendingSession(temp_id);

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "Sesi login sudah kedaluwarsa. Silakan login ulang.",
      });
    }

    // Verifikasi 2FA code dengan secret
    const isValid = authenticator.verify({
      token: code,
      secret: session.two_factor_secret,
    });

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Kode 2FA tidak valid atau sudah kedaluwarsa",
      });
    }

    // ✅ 2FA Valid - Sign in user untuk dapatkan session token
    const { data: signInData, error: signInError } =
      await supabaseAdmin.auth.signInWithPassword({
        email: session.email,
        password: session.password,
      });

    if (signInError || !signInData.session) {
      console.error("Sign in error after 2FA:", signInError);
      return res.status(500).json({
        success: false,
        message: "Gagal membuat session setelah verifikasi 2FA",
      });
    }

    // Hapus pending session dari cache
    deletePendingSession(temp_id);

    console.log(`✅ 2FA verified for: ${session.email}`);

    return res.status(200).json({
      success: true,
      message: "2FA verifikasi berhasil",
      token: signInData.session.access_token,
      user: {
        id: session.userId,
        email: session.email,
        full_name: session.full_name,
        role: session.role,
      },
    });
  } catch (error) {
    console.error("Verify 2FA Code Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat verifikasi kode 2FA",
    });
  }
};

/**
 * Disable 2FA - Nonaktifkan 2FA
 * Endpoint: POST /api/auth/2fa/disable
 */
const disable = async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Kode verifikasi wajib diisi untuk konfirmasi",
      });
    }

    // ✅ Validasi: Hanya super_admin
    const validation = await checkSuperAdmin(userId);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    // Ambil secret dari database
    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_secret, two_factor_enabled")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    if (!profile.two_factor_enabled) {
      return res.status(400).json({
        success: false,
        message: "2FA sudah tidak aktif",
      });
    }

    // Verifikasi code sebelum disable
    const isValid = authenticator.verify({
      token: code,
      secret: profile.two_factor_secret,
    });

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Kode verifikasi tidak valid",
      });
    }

    // Disable 2FA dan hapus secret
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        two_factor_enabled: false,
        two_factor_secret: null,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error disabling 2FA:", updateError);
      return res.status(500).json({
        success: false,
        message: "Gagal menonaktifkan 2FA",
      });
    }

    return res.status(200).json({
      success: true,
      message: "2FA berhasil dinonaktifkan",
    });
  } catch (error) {
    console.error("Disable 2FA Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menonaktifkan 2FA",
    });
  }
};

/**
 * Get Status - Cek status 2FA user
 * Endpoint: GET /api/auth/2fa/status
 */
const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // ✅ Validasi: Hanya super_admin
    const validation = await checkSuperAdmin(userId);
    if (validation.error) {
      return res.status(403).json({
        success: false,
        message: validation.error,
      });
    }

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from("profiles")
      .select("two_factor_enabled")
      .eq("id", userId)
      .single();

    if (fetchError || !profile) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        two_factor_enabled: profile.two_factor_enabled || false,
      },
    });
  } catch (error) {
    console.error("Get 2FA Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengecek status 2FA",
    });
  }
};

module.exports = {
  setup,
  verifySetup,
  verifyCode,
  disable,
  getStatus,
};
