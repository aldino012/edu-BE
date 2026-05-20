const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Content = sequelize.define('Content', {
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
      model: 'categories', // Merujuk ke nama tabel categories
      key: 'id'
    }
  },
  value: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  audio_url: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'contents',
  timestamps: false // Mengikuti struktur tabel yang tidak memiliki createdAt/updatedAt
});

module.exports = Content;