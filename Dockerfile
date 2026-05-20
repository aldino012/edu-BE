# 1. Gunakan image Node.js versi 24 (versi slim agar ukurannya lebih ringan)
FROM node:24-slim

# 2. Tentukan folder kerja di dalam kontainer
WORKDIR /app

# 3. Salin package.json dan package-lock.json lebih dulu
# Trik ini digunakan agar Docker bisa melakukan cache pada dependensi
COPY package*.json ./

# 4. Install semua dependensi Node.js
RUN npm install

# 5. Salin seluruh kode Backend Anda dari laptop ke dalam kontainer
COPY . .

# 6. Buka port 3000 agar bisa berkomunikasi dengan dunia luar
EXPOSE 3000

# 7. Perintah utama untuk menyalakan Backend saat kontainer berjalan
# Di Docker, kita cukup menjalankan Node secara langsung karena kontainer 
# itu sendiri sudah berfungsi sebagai pengawas (supervisor) seperti PM2.
CMD ["node", "server.js"]