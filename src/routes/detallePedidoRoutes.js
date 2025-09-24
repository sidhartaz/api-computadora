const express = require('express');
const router = express.Router();
const detallePedidoController = require('../controllers/detallePedidoController');

// CRUD DetallePedidos
router.get('/', detallePedidoController.obtenerTodos);
router.get('/pedido/:idPedido', detallePedidoController.obtenerPorPedido);
router.post('/', detallePedidoController.crear);
router.put('/:idPedido/:idProducto', detallePedidoController.actualizar);
router.delete('/:idPedido/:idProducto', detallePedidoController.eliminar);

module.exports = router;
