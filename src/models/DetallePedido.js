const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Modelo DetallePedido
const DetallePedido = sequelize.define('DetallePedido', {
  DetalleID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
    field: 'DetalleID'
  },
  PedidoID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Pedidos',   // nombre exacto de la tabla
      key: 'PedidoID'     // columna exacta
    },
    field: 'PedidoID'
  },
  ProductoID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Productos', // nombre exacto de la tabla
      key: 'ProductoID'   // columna exacta
    },
    field: 'ProductoID'
  },
  Cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 },
    field: 'Cantidad'
  },
  PrecioUnitario: {
    type: DataTypes.DECIMAL(10,2),
    allowNull: false,
    validate: { min: 0.01 },
    field: 'PrecioUnitario'
  },
  OrdenCompra: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'OrdenCompra'
  }
}, {
  tableName: 'DetallesPedido', // coincide con la tabla
  timestamps: false,
  charset: 'utf8mb4',
  collate: 'utf8mb4_0900_ai_ci'
});

module.exports = DetallePedido;
