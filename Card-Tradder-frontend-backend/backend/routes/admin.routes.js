// Importa Express para crear el router de rutas
const express = require('express');
// Importa los middlewares de autenticación y autorización por rol
const { authRequired, requireRole } = require('../middlewares/auth');
// Importa el modelo User para trabajar con usuarios
const User = require('../models/User');
// Importa el modelo Listing para trabajar con publicaciones
const Listing = require('../models/Listing');

// Crea una instancia de router de Express
const router = express.Router();

// ---------------------- USUARIOS ----------------------

// Listar todos los usuarios
router.get('/users', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Busca todos los usuarios en la base de datos
    // .select('-password') excluye el campo password de los resultados
    // .lean() devuelve objetos planos en lugar de documentos de Mongoose
    const users = await User.find().select('-password').lean();
    // Devuelve la lista de usuarios como JSON
    res.json({ users });
  } catch (err) {
    // Si hay error, responde con estado 500
    res.status(500).json({ message: 'Error cargando usuarios' });
  }
});

// Editar datos básicos de un usuario (nombre, rol, isActive)
router.patch('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Extrae los campos que se pueden editar desde el body
    const { name, role, isActive } = req.body;
    // Lista de roles válidos para validar el valor recibido
    const validRoles = ['cliente', 'vendedor', 'admin'];

    // Objeto que contendrá solo los campos que realmente se van a actualizar
    const update = {};
    // Si viene un name truthy, se agrega al objeto de update
    if (name) update.name = name;
    // Si viene un role válido, se agrega al objeto de update
    if (role && validRoles.includes(role)) update.role = role;
    // Si viene isActive explícitamente como boolean, se agrega
    if (typeof isActive === 'boolean') update.isActive = isActive;

    // Busca al usuario por ID y actualiza con los campos de "update"
    // { new: true } indica que se devuelva el documento ya actualizado
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).select('-password'); // Excluye el password de la respuesta

    // Si no se encontró el usuario, responde 404
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Devuelve el usuario actualizado
    res.json({ user });
  } catch (err) {
    // Error genérico del servidor
    res.status(500).json({ message: 'Error actualizando usuario' });
  }
});

// Eliminar usuario (duro)
router.delete('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Elimina al usuario completamente de la base de datos por su ID
    await User.findByIdAndDelete(req.params.id);
    // Devuelve mensaje de confirmación
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    // Error al eliminar el usuario
    res.status(500).json({ message: 'Error eliminando usuario' });
  }
});

// ------------------- PUBLICACIONES -------------------

// Listar publicaciones (por estado, opcional)
router.get('/publications', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Extrae el estado de la query (?status=pendiente, etc.)
    const { status } = req.query; // ?status=pendiente
    // Filtro básico sin condiciones
    const filter = {};
    // Si se envía status, se agrega al filtro
    if (status) filter.status = status;

    // Busca las publicaciones que cumplen el filtro
    const listings = await Listing.find(filter)
      // Agrega info del vendedor (name, email, role)
      .populate('sellerId', 'name email role')
      // Convierte a objetos planos
      .lean();

    // Obtiene los cardId únicos de las publicaciones (ignora null/undefined)
    const cardIds = [...new Set(listings.map((lst) => lst.cardId).filter(Boolean))];
    // Carga el modelo Card en el mismo momento y busca cartas por id
    const cards = await require('../models/Card').find({ id: { $in: cardIds } }).lean();
    // Crea un mapa de id de carta -> objeto carta
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    // Enriquecer cada listing agregando el objeto "card" correspondiente si existe
    const enriched = listings.map((lst) => ({
      ...lst,
      card: cardMap.get(lst.cardId) || null,
    }));

    // Devuelve las publicaciones enriquecidas
    res.json({ listings: enriched });
  } catch (err) {
    // Error al cargar las publicaciones
    res.status(500).json({ message: 'Error cargando publicaciones' });
  }
});

// Cambiar estado de una publicación (aprobar / rechazar)
router.patch('/publications/:id/status', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Extrae el nuevo estado y la razón de rechazo del body
    const { status, rejectionReason } = req.body; // 'aprobada' | 'rechazada'
    // Lista de estados válidos que acepta el sistema
    const validStatuses = ['pendiente', 'aprobada', 'rechazada'];

    // Si el estado enviado no está en la lista, devuelve error 400
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    // Si el nuevo estado es 'rechazada' pero no viene motivo, devuelve error 400
    if (status === 'rechazada' && !rejectionReason) {
      return res.status(400).json({ message: 'Debes indicar el motivo de rechazo' });
    }

    // Arma el objeto de actualización
    const update = { status };
    // Si el estado es 'rechazada', guarda la razón; si no, deja en null
    update.rejectionReason = status === 'rechazada' ? rejectionReason : null;

    // Busca la publicación por ID y actualiza su estado
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).populate('sellerId', 'name email role'); // Agrega datos del vendedor

    // Si no se encontró la publicación, responde 404
    if (!listing) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    // Devuelve la publicación actualizada
    res.json({ listing });
  } catch (err) {
    // Error al actualizar la publicación
    res.status(500).json({ message: 'Error actualizando publicación' });
  }
});

// Eliminar publicación
router.delete('/publications/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    // Elimina la publicación por su ID directamente de la BD
    await Listing.findByIdAndDelete(req.params.id);
    // Devuelve mensaje de confirmación
    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    // Error al intentar eliminar la publicación
    res.status(500).json({ message: 'Error eliminando publicación' });
  }
});

// Exporta el router para usarlo en server.js o en el archivo principal de rutas
module.exports = router;
