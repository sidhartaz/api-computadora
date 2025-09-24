// src/controllers/detallePedidoController.js
const { DetallePedido, Pedido, Producto } = require('../models');

const detallePedidoController = {
  // GET /api/detalle-pedidos - Obtener todos los detalles
  obtenerTodos: async (req, res) => {
    try {
      console.log('Buscando todos los detalles de pedidos...');
      const detalles = await DetallePedido.findAll({
        include: [
          { model: Pedido, as: 'pedido', attributes: ['PedidoID', 'Fecha', 'ClienteID'] },
          { model: Producto, as: 'producto', attributes: ['ProductoID', 'Nombre', 'PrecioUnitario'] }
        ],
        order: [['PedidoID', 'ASC'], ['ProductoID', 'ASC']]
      });
      console.log(`Se encontraron ${detalles.length} detalles`);
      res.status(200).json({
        mensaje: 'Detalles de pedidos obtenidos exitosamente',
        cantidad: detalles.length,
        datos: detalles
      });
    } catch (error) {
      console.error('Error al obtener detalles:', error.message);
      res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
  },

  // GET /api/detalle-pedidos/pedido/:idPedido
  obtenerPorPedido: async (req, res) => {
    try {
      const { idPedido } = req.params;
      console.log(`Buscando detalles del pedido ID: ${idPedido}`);

      const pedido = await Pedido.findByPk(idPedido);
      if (!pedido) {
        return res.status(404).json({ mensaje: `Pedido con ID ${idPedido} no encontrado` });
      }

      const detalles = await DetallePedido.findAll({
        where: { PedidoID: idPedido },
        include: [
          { model: Producto, as: 'producto', attributes: ['ProductoID', 'Nombre', 'PrecioUnitario'] }
        ],
        order: [['ProductoID', 'ASC']]
      });

      console.log(`Se encontraron ${detalles.length} detalles para el pedido ${idPedido}`);
      res.status(200).json({
        mensaje: `Detalles del pedido ${idPedido} obtenidos exitosamente`,
        pedido_id: idPedido,
        cantidad: detalles.length,
        datos: detalles
      });
    } catch (error) {
      console.error('Error al obtener detalles por pedido:', error.message);
      res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
  },

  // POST /api/detalle-pedidos
  crear: async (req, res) => {
    try {
      const { PedidoID, ProductoID, Cantidad, PrecioUnitario, OrdenCompra } = req.body;
      console.log('Creando nuevo detalle:', { PedidoID, ProductoID, Cantidad });

      const pedido = await Pedido.findByPk(PedidoID);
      if (!pedido) return res.status(400).json({ mensaje: `Pedido con ID ${PedidoID} no encontrado` });

      const producto = await Producto.findByPk(ProductoID);
      if (!producto) return res.status(400).json({ mensaje: `Producto con ID ${ProductoID} no encontrado` });

      const nuevoDetalle = await DetallePedido.create({
        PedidoID,
        ProductoID,
        Cantidad,
        PrecioUnitario: PrecioUnitario || producto.PrecioUnitario,
        OrdenCompra
      });

      const detalleCompleto = await DetallePedido.findOne({
        where: { PedidoID, ProductoID },
        include: [{ model: Producto, as: 'producto', attributes: ['Nombre', 'PrecioUnitario'] }]
      });

      res.status(201).json({
        mensaje: 'Detalle de pedido creado exitosamente',
        datos: detalleCompleto
      });
    } catch (error) {
      console.error('Error al crear detalle:', error.message);
      res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
  },

  // PUT /api/detalle-pedidos/:idPedido/:idProducto
  actualizar: async (req, res) => {
    try {
      const { idPedido, idProducto } = req.params;
      const { Cantidad, PrecioUnitario } = req.body;
      console.log(`Actualizando detalle pedido ${idPedido}, producto ${idProducto}`);

      const detalle = await DetallePedido.findOne({ where: { PedidoID: idPedido, ProductoID: idProducto } });
      if (!detalle) return res.status(404).json({ mensaje: `Detalle no encontrado` });

      await detalle.update({
        Cantidad: Cantidad ?? detalle.Cantidad,
        PrecioUnitario: PrecioUnitario ?? detalle.PrecioUnitario
      });

      const detalleActualizado = await DetallePedido.findOne({
        where: { PedidoID: idPedido, ProductoID: idProducto },
        include: [{ model: Producto, as: 'producto', attributes: ['Nombre', 'PrecioUnitario'] }]
      });

      res.status(200).json({
        mensaje: 'Detalle actualizado exitosamente',
        datos: detalleActualizado
      });
    } catch (error) {
      console.error('Error al actualizar detalle:', error.message);
      res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
  },

  // DELETE /api/detalle-pedidos/:idPedido/:idProducto
  eliminar: async (req, res) => {
    try {
      const { idPedido, idProducto } = req.params;
      console.log(`Eliminando detalle pedido ${idPedido}, producto ${idProducto}`);

      const detalle = await DetallePedido.findOne({ where: { PedidoID: idPedido, ProductoID: idProducto } });
      if (!detalle) return res.status(404).json({ mensaje: 'Detalle no encontrado' });

      await detalle.destroy();

      res.status(200).json({ mensaje: `Detalle de pedido ${idPedido} y producto ${idProducto} eliminado exitosamente` });
    } catch (error) {
      console.error('Error al eliminar detalle:', error.message);
      res.status(500).json({ mensaje: 'Error interno del servidor', error: error.message });
    }
  }
};

module.exports = detallePedidoController;


