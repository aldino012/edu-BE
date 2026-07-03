const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");
const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} = require("../config/supabase");

const requireAdmin = async (req, res, next) => {
  const authHeader = req.header("Authorization");

  console.log("🔍 RAW Auth Header:", authHeader);
  console.log("🔍 Auth Header Length:", authHeader?.length);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message:
        "Akses Ditolak! Token tidak ditemukan atau format salah (harus Bearer <token>).",
    });
  }

  const token = authHeader.split(" ")[1].trim();

  console.log("🔍 Token Length:", token.length);
  console.log("🔍 Token Start:", token.substring(0, 100));
  console.log("🔍 Token End:", token.substring(token.length - 50));
  console.log("🔍 Token has dots:", (token.match(/\./g) || []).length, "dots");

  try {
    if (token.length < 100) {
      return res.status(401).json({
        success: false,
        message: `Token terlalu pendek (${token.length} karakter). Pastikan copy seluruh token dari response login.`,
      });
    }

    // Decode token tanpa verifikasi signature
    let decoded;
    try {
      decoded = jwt.decode(token);
      console.log("🔍 Decoded Token:", {
        sub: decoded?.sub,
        email: decoded?.email,
        exp: decoded?.exp,
      });
    } catch (decodeError) {
      console.error("❌ Decode Error:", decodeError);
      return res.status(401).json({
        success: false,
        message: "Token tidak valid atau rusak.",
      });
    }

    if (!decoded || !decoded.sub) {
      return res.status(401).json({
        success: false,
        message: "Token tidak mengandung informasi user.",
      });
    }

    const userId = decoded.sub;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, is_approved, full_name, id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("❌ Profile Error:", profileError);
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
    const isApprovedAdmin = profile.role === "admin" && profile.is_approved;

    if (!isSuperAdmin && !isApprovedAdmin) {
      return res.status(403).json({
        success: false,
        message: "Akses Ditolak! Anda tidak memiliki izin admin.",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    req.user = { id: userId, email: decoded.email };
    req.supabase = supabase;
    req.isSuperAdmin = isSuperAdmin;
    req.userProfile = profile;

    console.log("✅ Middleware Success:", {
      userId,
      userEmail: decoded.email,
      role: profile.role,
      isSuperAdmin,
    });

    next();
  } catch (error) {
    console.error("❌ Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat memverifikasi token.",
    });
  }
};

module.exports = requireAdmin;