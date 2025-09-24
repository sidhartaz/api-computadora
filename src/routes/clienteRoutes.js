const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

// CRUD Clientes
router.get('/', clienteController.obtenerTodos);
router.get('/:id', clienteController.obtenerPorId);
router.post('/', clienteController.crear);
router.put('/:id', clienteController.actualizar);
router.delete('/:id', clienteController.eliminar);

module.exports = router;
