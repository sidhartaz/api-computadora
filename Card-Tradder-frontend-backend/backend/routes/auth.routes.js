// Importa Express para crear el router de rutas
const express = require('express');
// Importa middlewares de autenticación y validación de rol
const { authRequired, requireRole } = require('../middlewares/auth');
// Importa los controladores relacionados con autenticación y perfil de usuario
const {
  adminSales,
  getProfile,
  login,
  register,
  updateProfile,
} = require('../controllers/authController');

// Crea una nueva instancia de router de Express
const router = express.Router();

// Ruta para registrar un nuevo usuario
// POST /api/auth/register
// No requiere autenticación previa
router.post('/register', register);

// Ruta para iniciar sesión (login) de un usuario
// POST /api/auth/login
// No requiere autenticación previa
router.post('/login', login);

// Ruta para obtener el perfil del usuario autenticado
// GET /api/auth/me
// Requiere tener un token válido (authRequired)
router.get('/me', authRequired, getProfile);

// Ruta para actualizar el perfil del usuario autenticado
// PATCH /api/auth/me
// Requiere estar autenticado
router.patch('/me', authRequired, updateProfile);

// Ruta de ejemplo para una sección de administración de ventas
// GET /api/auth/admin/ventas
// Requiere estar autenticado Y tener rol 'admin'
router.get('/admin/ventas', authRequired, requireRole('admin'), adminSales);

// Exporta el router para usarlo en server.js u otro archivo de rutas principal
module.exports = router;
