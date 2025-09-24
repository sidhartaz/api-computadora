const express = require('express');
const router = express.Router();
const productoController = require('../controllers/productoController');

// CRUD Productos
router.get('/', productoController.obtenerTodos);
router.get('/:id', productoController.obtenerPorId);
router.post('/', productoController.crear);
router.put('/:id', productoController.actualizar);
router.delete('/:id', productoController.eliminar);

// Ruta adicional: buscar productos por nombre
router.get('/buscar/:nombre', productoController.buscarPorNombre);

module.exports = router;
