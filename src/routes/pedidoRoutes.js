const express = require('express');
const router = express.Router();
const pedidoController = require('../controllers/pedidoController');

// CRUD Pedidos
router.get('/', pedidoController.obtenerTodos);
router.get('/:id', pedidoController.obtenerPorId);
router.post('/', pedidoController.crear);
router.put('/:id', pedidoController.actualizar);
router.delete('/:id', pedidoController.eliminar);

// Obtener pedidos de un cliente
router.get('/cliente/:idCliente', pedidoController.obtenerPorCliente);

module.exports = router;
