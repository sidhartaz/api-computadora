const Cliente = require('./Cliente');
const Producto = require('./Producto');
const Pedido = require('./Pedido');
const DetallePedido = require('./DetallePedido');

// Un cliente tiene muchos pedidos
Cliente.hasMany(Pedido, { foreignKey: 'ClienteID', as: 'pedidos' });
Pedido.belongsTo(Cliente, { foreignKey: 'ClienteID', as: 'Cliente' });

// Un pedido tiene muchos detalles
Pedido.hasMany(DetallePedido, { foreignKey: 'PedidoID', as: 'detalles' });
DetallePedido.belongsTo(Pedido, { foreignKey: 'PedidoID', as: 'pedido' });

// Un producto puede estar en muchos detalles
Producto.hasMany(DetallePedido, { foreignKey: 'ProductoID', as: 'detalles' });
DetallePedido.belongsTo(Producto, { foreignKey: 'ProductoID', as: 'producto' });

module.exports = { Cliente, Producto, Pedido, DetallePedido };
