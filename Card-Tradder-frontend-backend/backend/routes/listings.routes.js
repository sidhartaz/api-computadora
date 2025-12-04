// Importa Express para crear el router de rutas
const express = require('express');
// Importa los middlewares de autenticación y control de roles
const { authRequired, requireRole } = require('../middlewares/auth');
// Importa los controladores que manejan la lógica de las publicaciones/listings
const {
  createListing,
  deleteListing,
  getApprovedListings,
  getFeaturedListing,
  getListingById,
  getListingContact,
  getMyListings,
  updateListing,
} = require('../controllers/listingController');

// Crea una instancia de router de Express
const router = express.Router();

// Ruta para obtener las publicaciones aprobadas y activas (listado público principal)
// GET /api/listings
router.get('/', getApprovedListings);

// Ruta para obtener las publicaciones del usuario autenticado con rol 'vendedor'
// GET /api/listings/mine
// Requiere estar autenticado y tener rol "vendedor"
router.get('/mine', authRequired, requireRole('vendedor'), getMyListings);

// Ruta para obtener una publicación destacada (más buscada, etc.)
// GET /api/listings/featured
router.get('/featured', getFeaturedListing);

// Ruta para obtener una publicación específica por su ID
// GET /api/listings/:id
router.get('/:id', getListingById);

// Ruta para obtener el contacto (WhatsApp) del vendedor de una publicación
// GET /api/listings/:id/contact
// Requiere estar autenticado (las reglas de acceso están en el controlador)
router.get('/:id/contact', authRequired, getListingContact);

// Ruta para crear una nueva publicación
// POST /api/listings
// Requiere estar autenticado y tener rol "vendedor"
router.post('/', authRequired, requireRole('vendedor'), createListing);

// Ruta para actualizar una publicación existente por ID
// PUT /api/listings/:id
// Requiere autenticación y rol "vendedor"
router.put('/:id', authRequired, requireRole('vendedor'), updateListing);

// Ruta para eliminar una publicación por ID
// DELETE /api/listings/:id
// También requiere autenticación y rol "vendedor"
router.delete('/:id', authRequired, requireRole('vendedor'), deleteListing);

// Exporta el router para ser usado en server.js u otro archivo de rutas principal
module.exports = router;
