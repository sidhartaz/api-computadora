// Importa Express para crear un router de rutas
const express = require('express');
// Importa los controladores relacionados con cartas
const { autocompleteCards, getCardDetails, searchCards } = require('../controllers/cardController');
// Importa el middleware de caché para búsquedas de cartas
const { cacheCardsSearch } = require('../middlewares/cache');

// Crea una nueva instancia de router de Express
const router = express.Router();

// Ruta para buscar cartas con filtros y paginación
// GET /api/cards/search
// Primero pasa por cacheCardsSearch para intentar responder desde Redis
// Si no hay cache, continúa a searchCards
router.get('/search', cacheCardsSearch, searchCards);

// Ruta para autocompletar nombres de cartas
// GET /api/cards/autocomplete?q=...
router.get('/autocomplete', autocompleteCards);

// Ruta para obtener el detalle de una carta específica por su id (campo "id" del modelo Card, no _id)
// GET /api/cards/:id
router.get('/:id', getCardDetails);

// Exporta el router para usarlo en el archivo principal de rutas (por ejemplo, server.js)
module.exports = router;
