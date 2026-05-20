/**
 * Helper untuk menentukan answer_key berdasarkan label konten
 * @param {string} correctLabel - Label dari jawaban yang benar
 * @param {object} options - Objek yang berisi opsi a, b, c, dan d
 * @returns {string|null} - Mengembalikan 'A', 'B', 'C', 'D', atau null
 */
const determineAnswerKey = (correctLabel, options) => {
  const { a, b, c, d } = options;
  if (a === correctLabel) return "A";
  if (b === correctLabel) return "B";
  if (c === correctLabel) return "C";
  if (d === correctLabel) return "D";
  return null;
};

module.exports = {
  determineAnswerKey,
};