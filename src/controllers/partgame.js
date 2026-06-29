// Main controller untuk Part Game
// Mengimport dan mengeksport semua fungsi dari modul partgame

const {
  getReadingContent,
  getReadingDetail,
  splitIntoSyllables,
} = require("./partgame/read");

module.exports = {
  // Reading game (Ayo Membaca)
  getReadingContent,
  getReadingDetail,

  // Utility functions
  splitIntoSyllables,
};
