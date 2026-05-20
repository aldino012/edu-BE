const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  question_text: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  correct_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'contents',
      key: 'id'
    }
  },
  // Tambahan kolom untuk pilihan jawaban (Multiple Choice)
  option_a: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  option_b: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  option_c: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  option_d: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  // Kolom untuk menentukan string mana yang benar (misal isinya: 'A' atau 'B')
  answer_key: {
    type: DataTypes.STRING(5),
    allowNull: false
  }
}, {
  tableName: 'quizzes',
  timestamps: false 
});

module.exports = Quiz;