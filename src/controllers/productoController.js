// src/controllers/productoController.js
const { Producto } = require('../models');
const { Op } = require('sequelize');

const productoController = {
  // GET /api/productos - Obtener todos los productos
  obtenerTodos: async (req, res) => {
    try {
      console.log('Buscando todos los productos...');
      const productos = await Producto.findAll({
        order: [['Nombre', 'ASC']] // Ordenar por nombre
      });
      console.log(`Se encontraron ${productos.length} productos`);
      res.status(200).json({
        mensaje: 'Productos obtenidos exitosamente',
        cantidad: productos.length,
        datos: productos
      });
    } catch (error) {
      console.error('Error al obtener productos:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // GET /api/productos/:id - Obtener un producto específico
  obtenerPorId: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Buscando producto con ID: ${id}`);
      const producto = await Producto.findByPk(id);
      if (!producto) {
        console.log(`Producto con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Producto con ID ${id} no encontrado`
        });
      }
      console.log(`Producto encontrado: ${producto.Nombre}`);
      res.status(200).json({
        mensaje: 'Producto encontrado exitosamente',
        datos: producto
      });
    } catch (error) {
      console.error('Error al obtener producto:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // GET /api/productos/buscar/:nombre - Buscar productos por nombre parcial
  buscarPorNombre: async (req, res) => {
    try {
      const { nombre } = req.params;
      console.log(`Buscando productos que contienen: ${nombre}`);
      const productos = await Producto.findAll({
        where: {
          Nombre: {
            [Op.like]: `%${nombre}%`
          }
        },
        order: [['Nombre', 'ASC']]
      });
      console.log(`Se encontraron ${productos.length} productos`);
      res.status(200).json({
        mensaje: `Productos que contienen "${nombre}" obtenidos exitosamente`,
        cantidad: productos.length,
        datos: productos
      });
    } catch (error) {
      console.error('Error al buscar productos:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // POST /api/productos - Crear un nuevo producto
  crear: async (req, res) => {
    try {
      const { Nombre, PrecioUnitario } = req.body;
      console.log('Creando nuevo producto:', { Nombre, PrecioUnitario });
      const nuevoProducto = await Producto.create({
        Nombre,
        PrecioUnitario
      });
      console.log(`Producto creado con ID: ${nuevoProducto.ProductoID}`);
      res.status(201).json({
        mensaje: 'Producto creado exitosamente',
        datos: nuevoProducto
      });
    } catch (error) {
      console.error('Error al crear producto:', error.message);
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

  // PUT /api/productos/:id - Actualizar un producto
  actualizar: async (req, res) => {
    try {
      const { id } = req.params;
      const { Nombre, PrecioUnitario } = req.body;
      console.log(`Actualizando producto ID: ${id}`);
      const producto = await Producto.findByPk(id);
      if (!producto) {
        console.log(`Producto con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Producto con ID ${id} no encontrado`
        });
      }
      await producto.update({ Nombre, PrecioUnitario });
      console.log(`Producto actualizado: ${producto.Nombre}`);
      res.status(200).json({
        mensaje: 'Producto actualizado exitosamente',
        datos: producto
      });
    } catch (error) {
      console.error('Error al actualizar producto:', error.message);
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  },

  // DELETE /api/productos/:id - Eliminar un producto
  eliminar: async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`Eliminando producto ID: ${id}`);
      const producto = await Producto.findByPk(id);
      if (!producto) {
        console.log(`Producto con ID ${id} no encontrado`);
        return res.status(404).json({
          mensaje: `Producto con ID ${id} no encontrado`
        });
      }
      const nombreProducto = producto.Nombre;
      await producto.destroy();
      console.log(`Producto eliminado: ${nombreProducto}`);
      res.status(200).json({
        mensaje: `Producto "${nombreProducto}" eliminado exitosamente`
      });
    } catch (error) {
      console.error('Error al eliminar producto:', error.message);
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          mensaje: 'No se puede eliminar el producto porque está en pedidos',
          solucion: 'Elimina primero los detalles que lo referencian'
        });
      }
      res.status(500).json({
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  }
};

module.exports = productoController;

