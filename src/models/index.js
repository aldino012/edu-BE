const sequelize = require('../config/db');

// Import semua model
const Category = require('./categoryModel');
const Content = require('./contentModel');
const Quiz = require('./quizModel');

// --- Definisi Relasi ---

// 1. Relasi Category dengan Content (1 to Many)
Category.hasMany(Content, { 
  foreignKey: 'category_id', 
  as: 'contents' 
});
Content.belongsTo(Category, { 
  foreignKey: 'category_id', 
  as: 'category' 
});

// 2. Relasi Category dengan Quiz (1 to Many)
Category.hasMany(Quiz, { 
  foreignKey: 'category_id', 
  as: 'quizzes' 
});
Quiz.belongsTo(Category, { 
  foreignKey: 'category_id', 
  as: 'category' 
});

// 3. Relasi Quiz dengan Content (PENTING)
// Kita gunakan alias 'question_details' agar saat di Controller 
// kita bisa memanggil data gambar/audio dengan nama tersebut.
Quiz.belongsTo(Content, { 
  foreignKey: 'correct_id', 
  as: 'question_details' 
});

// Export semua model beserta instance sequelize-nya
module.exports = {
  sequelize,
  Category,
  Content,
  Quiz
};