const { Content, Category } = require("../../models");
const { Op } = require("sequelize");

/**
 * Fungsi untuk memenggal kata menjadi suku kata bahasa Indonesia
 * Algoritma linguistik yang lebih pintar dengan aturan:
 * 1. Setiap suku kata mengandung minimal 1 vokal
 * 2. Konsonan tunggal di antara 2 vokal → masuk ke suku kata berikutnya
 * 3. Konsonan ganda (ng, ny, sy, kh) → tidak dipisah
 * 4. Diftong (ai, au, oi, ei, ui, iu) → tidak dipisah
 * 5. Konsonan di akhir kata → melekat ke vokal sebelumnya
 */
const splitIntoSyllables = (word) => {
  if (!word || typeof word !== "string") return [];

  word = word.toLowerCase().trim();
  if (word.length === 0) return [];

  const vowels = "aiueo";
  const isVowel = (char) => vowels.includes(char.toLowerCase());

  // Diftong Indonesia (2 vokal yang dibaca 1 suku kata)
  const diphthongs = ["ai", "au", "oi", "ei", "ui", "iu", "ia", "ua"];

  // Konsonan ganda/khusus Indonesia
  const consonantClusters = ["ng", "ny", "sy", "kh"];

  // Temukan posisi semua vokal dalam kata
  const vowelPositions = [];
  for (let i = 0; i < word.length; i++) {
    if (isVowel(word[i])) {
      vowelPositions.push(i);
    }
  }

  // Jika tidak ada vokal, kembalikan kata utuh
  if (vowelPositions.length === 0) {
    return [word];
  }

  const syllables = [];
  let startIndex = 0;

  for (let i = 0; i < vowelPositions.length; i++) {
    const vowelPos = vowelPositions[i];
    const nextVowelPos = vowelPositions[i + 1];

    // 1. Tentukan awal suku kata (ambil konsonan sebelum vokal)
    let syllableStart = vowelPos;
    if (vowelPos > startIndex) {
      syllableStart = startIndex;
    }

    // 2. Tentukan akhir suku kata
    let syllableEnd = vowelPos + 1; // Default: sampai setelah vokal

    if (nextVowelPos !== undefined) {
      // Ada vokal berikutnya
      const consonantsBetween = word.substring(vowelPos + 1, nextVowelPos);

      if (consonantsBetween.length === 0) {
        // 2 vokal berurutan - cek diftong
        const potentialDiphthong = word.substring(vowelPos, nextVowelPos + 1);
        if (diphthongs.includes(potentialDiphthong)) {
          // Ini diftong - gabungkan ke suku kata ini
          syllableEnd = nextVowelPos + 1;
          // Skip vokal berikutnya
          i++;
        } else {
          // Bukan diftong - pisah
          syllableEnd = vowelPos + 1;
        }
      } else if (consonantsBetween.length === 1) {
        // 1 konsonan di antara 2 vokal → masuk ke suku kata berikutnya
        syllableEnd = vowelPos + 1;
      } else if (consonantsBetween.length === 2) {
        // 2 konsonan di antara 2 vokal
        const cluster = consonantsBetween;

        // Cek apakah ini konsonan ganda
        if (consonantClusters.includes(cluster)) {
          // Konsonan ganda → tetap di suku kata ini
          syllableEnd = nextVowelPos;
        } else {
          // Konsonan biasa → bagi di tengah
          // Konsonan pertama di sini, kedua di suku berikutnya
          syllableEnd = vowelPos + 2;
        }
      } else if (consonantsBetween.length >= 3) {
        // 3+ konsonan - bagi secara logis
        const firstTwo = consonantsBetween.substring(0, 2);

        if (consonantClusters.includes(firstTwo)) {
          // Konsonan ganda di awal → tetap di sini + 1 konsonan lagi
          syllableEnd = vowelPos + 3;
        } else {
          // Bagi setelah konsonan pertama
          syllableEnd = vowelPos + 1;
        }
      }
    } else {
      // Ini vokal terakhir - ambil semua konsonan di akhir
      syllableEnd = word.length;
    }

    // Tambahkan suku kata
    const syllable = word.substring(syllableStart, syllableEnd);
    if (syllable.length > 0) {
      syllables.push(syllable);
    }

    // Update startIndex untuk suku kata berikutnya
    startIndex = syllableEnd;
  }

  // Tambahkan sisa konsonan jika ada (jarang terjadi)
  if (startIndex < word.length) {
    const remaining = word.substring(startIndex);
    if (remaining.length > 0 && syllables.length > 0) {
      syllables[syllables.length - 1] += remaining;
    } else if (remaining.length > 0) {
      syllables.push(remaining);
    }
  }

  return syllables;
};

// Helper untuk validasi huruf A-Z
const isValidLetter = (letter) => {
  if (!letter) return false;
  const cleaned = String(letter).trim();
  return cleaned.length === 1 && /^[A-Za-z]$/.test(cleaned);
};

// Controller untuk mendapatkan konten "Ayo Membaca"
const getReadingContent = async (req, res) => {
  try {
    const letterCategory = await Category.findOne({
      where: {
        [Op.or]: [{ name: "Huruf" }, { id: 2 }],
      },
      include: [
        {
          model: Content,
          as: "contents",
          order: [["value", "ASC"]],
        },
      ],
    });

    if (!letterCategory) {
      return res.status(404).json({
        success: false,
        message: "Kategori Huruf tidak ditemukan",
      });
    }

    // Filter hanya konten yang memiliki huruf A-Z
    const letterContents = letterCategory.contents.filter((content) => {
      return isValidLetter(content.value);
    });

    // Proses setiap konten untuk memenggal kata
    const processedContents = letterContents.map((content) => {
      const word = content.label;
      const syllables = splitIntoSyllables(word);

      return {
        id: content.id,
        letter: content.value ? content.value.trim().toUpperCase() : null,
        word: word,
        syllables: syllables,
        syllableText: syllables.join("-"),
        imageUrl: content.image_url,
        audioUrl: content.audio_url,
      };
    });

    res.json({
      success: true,
      data: {
        category: letterCategory.name,
        categoryId: letterCategory.id,
        totalItems: processedContents.length,
        contents: processedContents,
      },
    });
  } catch (error) {
    console.error("Error fetching reading content:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil data",
      error: error.message,
    });
  }
};

// Controller untuk mendapatkan detail satu kata dengan pemenggalan
const getReadingDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const content = await Content.findOne({
      where: { id },
      include: [
        {
          model: Category,
          as: "category",
          where: {
            [Op.or]: [{ name: "Huruf" }, { id: 2 }],
          },
        },
      ],
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        message: "Konten tidak ditemukan",
      });
    }

    // Validasi bahwa ini adalah huruf A-Z
    if (!isValidLetter(content.value)) {
      return res.status(400).json({
        success: false,
        message: "Konten bukan huruf A-Z",
        debug: {
          value: content.value,
          type: typeof content.value,
          length: content.value ? String(content.value).length : 0,
        },
      });
    }

    const syllables = splitIntoSyllables(content.label);

    res.json({
      success: true,
      data: {
        id: content.id,
        letter: content.value.trim().toUpperCase(),
        word: content.label,
        syllables: syllables,
        syllableText: syllables.join("-"),
        imageUrl: content.image_url,
        audioUrl: content.audio_url,
        category: content.category,
      },
    });
  } catch (error) {
    console.error("Error fetching reading detail:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat mengambil detail",
      error: error.message,
    });
  }
};

module.exports = {
  getReadingContent,
  getReadingDetail,
  splitIntoSyllables,
  isValidLetter,
};
