const express = require('express');
const { authRequired, requireRole } = require('../middlewares/auth');
const User = require('../models/User');
const Listing = require('../models/Listing');

const router = express.Router();

// ---------------------- USUARIOS ----------------------

// Listar todos los usuarios
router.get('/users', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Error cargando usuarios' });
  }
});

// Editar datos básicos de un usuario (nombre, rol, isActive)
router.patch('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { name, role, isActive } = req.body;
    const validRoles = ['cliente', 'vendedor', 'admin'];

    const update = {};
    if (name) update.name = name;
    if (role && validRoles.includes(role)) update.role = role;
    if (typeof isActive === 'boolean') update.isActive = isActive;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando usuario' });
  }
});

// Eliminar usuario (duro)
router.delete('/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando usuario' });
  }
});

// ------------------- PUBLICACIONES -------------------

// Listar publicaciones (por estado, opcional)
router.get('/publications', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { status } = req.query; // ?status=pendiente
    const filter = {};
    if (status) filter.status = status;

    const listings = await Listing.find(filter)
      .populate('sellerId', 'name email role')
      .lean();

    const cardIds = [...new Set(listings.map((lst) => lst.cardId).filter(Boolean))];
    const cards = await require('../models/Card').find({ id: { $in: cardIds } }).lean();
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    const enriched = listings.map((lst) => ({
      ...lst,
      card: cardMap.get(lst.cardId) || null,
    }));

    res.json({ listings: enriched });
  } catch (err) {
    res.status(500).json({ message: 'Error cargando publicaciones' });
  }
});

// Cambiar estado de una publicación (aprobar / rechazar)
router.patch('/publications/:id/status', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { status, rejectionReason } = req.body; // 'aprobada' | 'rechazada'
    const validStatuses = ['pendiente', 'aprobada', 'rechazada'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    if (status === 'rechazada' && !rejectionReason) {
      return res.status(400).json({ message: 'Debes indicar el motivo de rechazo' });
    }

    const update = { status };
    update.rejectionReason = status === 'rechazada' ? rejectionReason : null;

    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).populate('sellerId', 'name email role');

    if (!listing) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    res.json({ listing });
  } catch (err) {
    res.status(500).json({ message: 'Error actualizando publicación' });
  }
});

// Eliminar publicación
router.delete('/publications/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    await Listing.findByIdAndDelete(req.params.id);
    res.json({ message: 'Publicación eliminada' });
  } catch (err) {
    res.status(500).json({ message: 'Error eliminando publicación' });
  }
});

module.exports = router;
