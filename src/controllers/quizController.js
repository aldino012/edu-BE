// Import semua fungsi dari sub-folder 'quiz'
const createQuiz = require("./quiz/create");
const { getRandomPlay, getAllQuizzes, getQuizById } = require("./quiz/read"); 
const updateQuiz = require("./quiz/update");
const deleteQuiz = require("./quiz/delete");

// Export kembali sebagai satu kesatuan objek controller
module.exports = {
  createQuiz,
  getRandomPlay,
  getAllQuizzes,
  getQuizById, 
  updateQuiz,
  deleteQuiz,
};