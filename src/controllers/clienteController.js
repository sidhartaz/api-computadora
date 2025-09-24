// src/controllers/clienteController.js
const Cliente = require('../models/Cliente'); // Importación directa del modelo

const clienteController = {
  // GET /api/clientes - Obtener todos los clientes
  obtenerTodos: async (req, res) => {
    try {
      console.log('Buscando todos los clientes...');
      const clientes = await Cliente.findAll({
        order: [['nombre', 'ASC']] // Ordenar por nombre alfabéticamente
      });
      console.log(`Se encontraron ${clientes.length} clientes`);
      res.status(200).json({
        mensaje: 'Clientes obtenidos exitosamente',
        cantidad: clientes.length,
        datos: clientes
      });
    } catch (error) {
      console.error('Error al obtener clientes:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // GET /api/clientes/:id - Obtener un cliente específico
  obtenerPorId: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Buscando cliente con ID: ${id}`);
      const cliente = await Cliente.findByPk(id);
      if (!cliente) {
        console.log(`Cliente con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Cliente con ID ${id} no encontrado`
        });
      }
      console.log(`Cliente encontrado: ${cliente.nombre}`);
      res.status(200).json({
        mensaje: 'Cliente encontrado exitosamente',
        datos: cliente
      });
    } catch (error) {
      console.error('Error al obtener cliente:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // POST /api/clientes - Crear un nuevo cliente
  crear: async (req, res) => {
    try {
      const { Nombre, Telefono } = req.body; // recibimos con mayúsculas
      console.log('Creando nuevo cliente:', { Nombre, Telefono });
      const nuevoCliente = await Cliente.create({
        nombre: Nombre,   // mapeamos Nombre → nombre
        telefono: Telefono // mapeamos Telefono → telefono
      });
      console.log(`Cliente creado con ID: ${nuevoCliente.ClienteID}`);
      res.status(201).json({
        mensaje: 'Cliente creado exitosamente',
        datos: nuevoCliente
      });
    } catch (error) {
      console.error('Error al crear cliente:', error.message);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          mensaje: 'El teléfono ya está registrado',
          error: 'Duplicado'
        });
      }
      if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
          mensaje: 'Datos inválidos',
          errores: error.errors.map(e => e.message)
        });
      }
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // PUT /api/clientes/:id - Actualizar un cliente
  actualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { Nombre, Telefono } = req.body; // recibimos con mayúsculas
      console.log(`Actualizando cliente ID: ${id}`);
      const cliente = await Cliente.findByPk(id);
      if (!cliente) {
        console.log(`Cliente con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Cliente con ID ${id} no encontrado`
        });
      }
      await cliente.update({
        nombre: Nombre,   // mapeamos a nombre
        telefono: Telefono // mapeamos a telefono
      });
      console.log(`Cliente actualizado: ${cliente.nombre}`);
      res.status(200).json({
        mensaje: 'Cliente actualizado exitosamente',
        datos: cliente
      });
    } catch (error) {
      console.error('Error al actualizar cliente:', error.message);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          mensaje: 'El teléfono ya está registrado por otro cliente',
          error: 'Duplicado'
        });
      }
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // DELETE /api/clientes/:id - Eliminar un cliente
  eliminar: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Eliminando cliente ID: ${id}`);
      const cliente = await Cliente.findByPk(id);
      if (!cliente) {
        console.log(`Cliente con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Cliente con ID ${id} no encontrado`
        });
      }
      const nombreCliente = cliente.nombre;
      await cliente.destroy();
      console.log(`Cliente eliminado: ${nombreCliente}`);
      res.status(200).json({
        mensaje: `Cliente "${nombreCliente}" eliminado exitosamente`
      });
    } catch (error) {
      console.error('Error al eliminar cliente:', error.message);
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          mensaje: 'No se puede eliminar el cliente porque tiene pedidos asociados',
          solucion: 'Elimina primero los pedidos del cliente'
        });
      }
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  }
};

module.exports = clienteController;
