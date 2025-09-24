const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Definir el modelo Producto (representa la tabla 'productos')
const Producto = sequelize.define('Producto', {
  // Columna producto_id (clave primaria)
  ProductoID: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Es la clave primaria
    autoIncrement: true, // Se incrementa automáticamente
    allowNull: false // No puede ser nulo
  },
  // Columna nombre
  Nombre: {
    type: DataTypes.STRING(100), // VARCHAR(100)
    allowNull: false, // Obligatorio
    validate: {
      notEmpty: { msg: 'El nombre es obligatorio' }
    }
  },
  // Columna precio_unitario
  PrecioUnitario: {
    type: DataTypes.DECIMAL(10,2), // Decimal con 2 decimales
    allowNull: false, // Obligatorio
    validate: {
      min: { args: [0.01], msg: 'El precio debe ser mayor a 0' }
    }
  }
}, {
  tableName: 'Productos', // Nombre exacto de la tabla en MySQL
  timestamps: false, // No agregar createdAt/updatedAt automáticamente
  charset: 'utf8mb4', // Codificación de caracteres
  collate: 'utf8mb4_0900_ai_ci' // Reglas de comparación
});

module.exports = Producto;
