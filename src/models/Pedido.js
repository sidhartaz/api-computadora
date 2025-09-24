const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  PedidoID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  Fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: sequelize.literal('CURRENT_DATE') // Solo fecha
  },
  ClienteID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Clientes', // Debe coincidir con la tabla real
      key: 'ClienteID'
    }
  }
}, {
  tableName: 'Pedidos',
  timestamps: false,
  charset: 'utf8mb4',
  collate: 'utf8mb4_0900_ai_ci'
});

module.exports = Pedido; // ✅ ahora correcto
