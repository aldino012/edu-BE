const requireAdmin = (req, res, next) => {
  // Mengambil header request Postman/Frontend yang bernama "Authorization"
  const authHeader = req.header('Authorization');

  // Jika tidak ada header sama sekali
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Akses Ditolak! Token tidak ditemukan.'
    });
  }

  // Frontend mengirimkan "Bearer AKU_ADALAH_TOKEN_EDU"
  // Kita harus memotong kata "Bearer " untuk mengambil token aslinya saja
  let token = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]; // Mengambil nilai di index 1 (setelah spasi)
  }

  // Mengecek apakah token asli cocok dengan ADMIN_TOKEN di .env
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({
      success: false,
      message: 'Akses Ditolak! Token tidak valid atau Anda tidak memiliki izin Admin.'
    });
  }

  // Jika token benar, izinkan request lanjut ke proses Controller
  next();
};

module.exports = requireAdmin;