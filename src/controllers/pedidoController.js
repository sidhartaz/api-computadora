// src/controllers/pedidoController.js
const { Pedido, Cliente, DetallePedido, Producto } = require('../models');

const pedidoController = {
  // GET /api/pedidos - Obtener todos los pedidos con información del cliente
  obtenerTodos: async (req, res) => {
    try {
      console.log('Buscando todos los pedidos...');
      const pedidos = await Pedido.findAll({
        include: [
          {
            model: Cliente,
            as: 'Cliente',
            attributes: ['ClienteID', 'Nombre', 'Telefono']
          }
        ],
        order: [['Fecha', 'DESC']]
      });
      console.log(`Se encontraron ${pedidos.length} pedidos`);
      res.status(200).json({
        mensaje: 'Pedidos obtenidos exitosamente',
        cantidad: pedidos.length,
        datos: pedidos
      });
    } catch (error) {
      console.error('Error al obtener pedidos:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // GET /api/pedidos/:id - Obtener un pedido con su detalle completo
  obtenerPorId: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Buscando pedido con ID: ${id}`);
      const pedido = await Pedido.findByPk(id, {
        include: [
          {
            model: Cliente,
            as: 'Cliente',
            attributes: ['ClienteID', 'Nombre', 'Telefono']
          },
          {
            model: DetallesPedido,
            as: 'detalles',
            include: [
              {
                model: Producto,
                as: 'producto',
                attributes: ['ProductoID', 'Nombre', 'PrecioUnitario']
              }
            ]
          }
        ]
      });
      if (!pedido) {
        console.log(`Pedido con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Pedido con ID ${id} no encontrado`
        });
      }
      console.log(`Pedido encontrado: ${pedido.PedidoID}`);
      res.status(200).json({
        mensaje: 'Pedido encontrado exitosamente',
        datos: pedido
      });
    } catch (error) {
      console.error('Error al obtener pedido:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // GET /api/pedidos/cliente/:idCliente - Obtener pedidos de un cliente
  obtenerPorCliente: async (req, res) => {
    try {
      const { idCliente } = req.params;
      console.log(`Buscando pedidos del cliente ID: ${idCliente}`);
      const cliente = await Cliente.findByPk(idCliente);
      if (!cliente) {
        return res.status(404).json({
          mensaje: `Cliente con ID ${idCliente} no encontrado`
        });
      }
      const pedidos = await Pedido.findAll({
        where: { ClienteID: idCliente },
        include: [
          {
            model: Cliente,
            as: 'Cliente',
            attributes: ['Nombre', 'Telefono']
          }
        ],
        order: [['Fecha', 'DESC']]
      });
      console.log(`Se encontraron ${pedidos.length} pedidos para ${cliente.Nombre}`);
      res.status(200).json({
        mensaje: `Pedidos del cliente "${cliente.Nombre}" obtenidos exitosamente`,
        cliente: cliente.Nombre,
        cantidad: pedidos.length,
        datos: pedidos
      });
    } catch (error) {
      console.error('Error al obtener pedidos por cliente:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // POST /api/pedidos - Crear un nuevo pedido
  crear: async (req, res) => {
    try {
      const { ClienteID, Fecha } = req.body;
      console.log('Creando nuevo pedido para cliente:', ClienteID);
      const cliente = await Cliente.findByPk(ClienteID);
      if (!cliente) {
        return res.status(400).json({
          mensaje: `Cliente con ID ${ClienteID} no encontrado`
        });
      }
      const nuevoPedido = await Pedido.create({
        ClienteID,
        Fecha: Fecha || new Date()
      });
      console.log(`Pedido creado con ID: ${nuevoPedido.PedidoID}`);
      res.status(201).json({
        mensaje: 'Pedido creado exitosamente',
        datos: nuevoPedido
      });
    } catch (error) {
      console.error('Error al crear pedido:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // PUT /api/pedidos/:id - Actualizar un pedido
  actualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { ClienteID, Fecha } = req.body;
      console.log(`Actualizando pedido ID: ${id}`);
      const pedido = await Pedido.findByPk(id);
      if (!pedido) {
        return res.status(404).json({
          mensaje: `Pedido con ID ${id} no encontrado`
        });
      }
      if (ClienteID && ClienteID !== pedido.ClienteID) {
        const cliente = await Cliente.findByPk(ClienteID);
        if (!cliente) {
          return res.status(400).json({
            mensaje: `Cliente con ID ${ClienteID} no encontrado`
          });
        }
      }
      await pedido.update({
        ClienteID: ClienteID || pedido.ClienteID,
        Fecha: Fecha || pedido.Fecha
      });
      console.log(`Pedido actualizado: ${pedido.PedidoID}`);
      res.status(200).json({
        mensaje: 'Pedido actualizado exitosamente',
        datos: pedido
      });
    } catch (error) {
      console.error('Error al actualizar pedido:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

// DELETE /api/pedidos/:id - Eliminar un pedido
eliminar: async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Eliminando pedido ID: ${id}`);
    
    const pedido = await Pedido.findByPk(id);
    if (!pedido) {
      return res.status(404).json({
        mensaje: `Pedido con ID ${id} no encontrado`
      });
    }

    // Primero eliminar todos los detalles del pedido
    const detallesEliminados = await DetallePedido.destroy({
      where: { PedidoID: id }
    });

    // Luego eliminar el pedido
    await pedido.destroy();
    
    console.log(`Pedido eliminado: ${id}, detalles eliminados: ${detallesEliminados}`);
    res.status(200).json({
      mensaje: `Pedido con ID ${id} eliminado exitosamente`,
      detallesEliminados: detallesEliminados
    });
  } catch (error) {
    console.error('Error al eliminar pedido:', error.message);
    res.status(500).json({
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
}

};

module.exports = pedidoController;


