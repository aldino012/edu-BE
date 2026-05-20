const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  }
}, {
  // Nama tabel di database
  tableName: 'categories',
  // Set false karena di tabelmu sepertinya tidak ada kolom createdAt dan updatedAt
  timestamps: false 
});

module.exports = Category;