const express = require('express');
const mongoose = require('mongoose');
const { authRequired } = require('../middlewares/auth');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const { expireOldReservations, DAY_IN_MS } = require('../utils/reservations');
const Card = require('../models/Card');
const User = require('../models/User');

const router = express.Router();
const DEFAULT_RESERVATION_HOURS = 24;

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
}

function canSeeListingContact(order, user) {
  if (!order?.listingId) return false;

  if (user.role === 'admin') return true;

  const sellerId = normalizeId(order.sellerId);
  if (sellerId && sellerId === user.id) return true;

  const buyerId = normalizeId(order.buyerId);
  const isReservationOwner = order.type === 'reserva' && buyerId === user.id;

  return isReservationOwner && order.status !== 'cancelada';
}

async function ensureContactForOrder(order, user) {
  if (!order?.listingId) return order;

  const canSee = canSeeListingContact(order, user);

  // Oculta el contacto si el usuario no está autorizado
  if (!canSee) {
    if (order.listingId.contactWhatsapp !== undefined) {
      const listingData = typeof order.listingId.toObject === 'function'
        ? order.listingId.toObject()
        : order.listingId;

      order.listingId = { ...listingData, contactWhatsapp: undefined };
    }

    return order;
  }

  const listingData = typeof order.listingId.toObject === 'function'
    ? order.listingId.toObject()
    : order.listingId;

  if (!listingData.contactWhatsapp) {
    const sellerId = normalizeId(order.sellerId);
    if (sellerId) {
      const seller = await User.findById(sellerId).select('contactWhatsapp').lean();
      if (seller?.contactWhatsapp) {
        listingData.contactWhatsapp = seller.contactWhatsapp;
      }
    }
  }

  order.listingId = listingData;
  return order;
}

async function markListingReservation(listingId, { reservedBy = null, reservedUntil = null, isActive }) {
  const update = {
    reservedBy,
    reservedUntil,
  };

  if (typeof isActive === 'boolean') {
    update.isActive = isActive;
  }

  await Listing.findByIdAndUpdate(listingId, {
    $set: update,
  });
}

async function attachCardData(orders) {
  const cardIds = [
    ...new Set(
      orders
        .map((order) => order.cardId)
        .filter(Boolean)
    ),
  ];

  if (!cardIds.length) return orders;

  const cards = await Card.find({ id: { $in: cardIds } }).lean();
  const cardMap = new Map(cards.map((card) => [card.id, card]));

  return orders.map((order) => ({
    ...order,
    card: cardMap.get(order.cardId) || null,
  }));
}

// Crear una orden o reserva
router.post('/', authRequired, async (req, res) => {
  try {
    const { listingId, type = 'compra', note } = req.body;

    if (!listingId) {
      return res.status(400).json({ message: 'listingId es obligatorio' });
    }

    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: 'El identificador de la publicación no es válido.' });
    }

    await expireOldReservations(Order, Listing);

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing no encontrado' });
    }

    if (listing.status !== 'aprobada') {
      return res.status(400).json({ message: 'La publicación debe estar aprobada para generar una orden' });
    }

    const weekAgo = new Date(Date.now() - 7 * DAY_IN_MS);
    const weeklyOrders = await Order.countDocuments({
      buyerId: req.user.id,
      status: { $ne: 'cancelada' },
      createdAt: { $gte: weekAgo },
    });

    if (weeklyOrders >= 7) {
      return res.status(400).json({ message: 'Solo puedes crear 7 compras o reservas por semana.' });
    }

    const normalizedType = type === 'reserva' ? 'reserva' : 'compra';

    if (normalizedType === 'reserva' && req.user.role !== 'cliente') {
      return res.status(403).json({ message: 'Solo los clientes pueden crear reservas.' });
    }

    const activeReservation = await Order.findOne({
      listingId,
      type: 'reserva',
      status: { $in: ['reservada', 'pendiente', 'pagada'] },
    });

    if (activeReservation) {
      const message =
        normalizedType === 'reserva'
          ? 'Esta publicación ya cuenta con una reserva activa.'
          : 'La publicación tiene una reserva pendiente o activa en este momento.';

      return res.status(400).json({ message });
    }

    if (!listing.isActive) {
      return res.status(400).json({ message: 'La publicación no está disponible para nuevas órdenes o reservas.' });
    }

    const initialStatus = 'pendiente';

    const buyer = await User.findById(req.user.id).select('name');
    const notifications = [];
    const reservationExpiresAt = null;

    if (normalizedType === 'reserva') {
      notifications.push({
        type: 'info',
        message: `${buyer?.name || 'El cliente'} ha solicitado una reserva para tu publicación "${listing.name}"`,
        recipient: 'seller',
      });
    }

    const order = await Order.create({
      listingId,
      cardId: listing.cardId || null,
      sellerId: listing.sellerId,
      buyerId: req.user.id,
      type: normalizedType,
      status: initialStatus,
      total: listing.price,
      history: [
        {
          status: initialStatus,
          note:
            note ||
            (normalizedType === 'reserva'
              ? 'Reserva creada y pendiente de aprobación'
              : 'Orden creada'),
          changedBy: req.user.id,
        },
      ],
      notes: note,
      notifications,
      reservationExpiresAt,
    });

    await order.populate([
      { path: 'buyerId', select: 'name email role' },
      { path: 'sellerId', select: 'name email role' },
      { path: 'listingId' },
    ]);

    await ensureContactForOrder(order, req.user);

    return res.status(201).json({ order });
  } catch (err) {
    console.error('Error en POST /api/orders:', err);
    return res.status(500).json({ message: 'Error al crear la orden', detail: err.message });
  }
});

// Listar órdenes (según rol)
router.get('/', authRequired, async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const filter = {};
    const { status, type } = req.query;
    if (status) filter.status = status;

    if (type) {
      const allowedTypes = ['compra', 'reserva'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Tipo de orden inválido' });
      }
      filter.type = type;
    }

    if (req.user.role === 'admin') {
      // Sin filtro adicional
    } else if (req.user.role === 'vendedor') {
      filter.sellerId = req.user.id;
    } else {
      filter.buyerId = req.user.id;
    }

    const orders = await Order.find(filter)
      .populate('buyerId', 'name email role')
      .populate('sellerId', 'name email role')
      .populate('listingId')
      .populate('history.changedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    const enrichedOrders = await attachCardData(orders);
    const sanitized = await Promise.all(
      enrichedOrders.map((order) => ensureContactForOrder(order, req.user))
    );

    return res.json({ orders: sanitized });
  } catch (err) {
    console.error('Error en GET /api/orders:', err);
    return res.status(500).json({ message: 'Error al listar órdenes' });
  }
});

// Detalle de una orden
router.get('/:id', authRequired, async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const order = await Order.findById(req.params.id)
      .populate('buyerId', 'name email role')
      .populate('sellerId', 'name email role')
      .populate('listingId')
      .populate('history.changedBy', 'name email role')
      .lean();

    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    const isBuyer = order.buyerId?._id?.toString() === req.user.id;
    const isSeller = order.sellerId?._id?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
    }

    const [orderWithCard] = await attachCardData([order]);
    const sanitized = await ensureContactForOrder(orderWithCard, req.user);

    return res.json({ order: sanitized });
  } catch (err) {
    console.error('Error en GET /api/orders/:id:', err);
    return res.status(500).json({ message: 'Error al obtener la orden' });
  }
});

// Actualizar estado (pago, cancelación, etc.)
router.patch('/:id/status', authRequired, async (req, res) => {
  try {
    const { status, note } = req.body;
    const allowedStatuses = ['pendiente', 'reservada', 'pagada', 'cancelada'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    const isSeller = order.sellerId.toString() === req.user.id;
    const isBuyer = order.buyerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Solo el vendedor puede aprobar la reserva; admin puede gestionar otros estados
    if (status === 'reservada' && !isSeller) {
      return res.status(403).json({ message: 'Solo el vendedor puede aprobar una reserva.' });
    }

    // Comprador solo puede cancelar su propia orden
    if (!isSeller && !isAdmin) {
      if (!(isBuyer && status === 'cancelada')) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar este estado' });
      }
    }

    const wasReservation = order.type === 'reserva';

    order.status = status;
    order.history.push({
      status,
      note: note || `Estado actualizado a ${status}`,
      changedBy: req.user.id,
    });

    if (wasReservation && status === 'reservada' && !order.reservationExpiresAt) {
      order.reservationExpiresAt = new Date(Date.now() + DEFAULT_RESERVATION_HOURS * 60 * 60 * 1000);
    }

    const sellerNotifyingPayment = isSeller && ['pagada', 'cancelada'].includes(status);
    const reservationApproved = wasReservation && status === 'reservada' && isSeller;

    if (reservationApproved) {
      order.notifications.push({
        type: 'reservada',
        message: 'Tu reserva fue aprobada. Tienes 24 horas para confirmar el pago.',
        recipient: 'buyer',
      });
    }

    if (sellerNotifyingPayment) {
      order.notifications.push({
        type: status,
        message: `La orden fue marcada como ${status} por el vendedor.`,
        recipient: 'buyer',
      });
    }

    await order.save();

    if (wasReservation) {
      if (status === 'cancelada') {
        await markListingReservation(order.listingId, {
          reservedBy: null,
          reservedUntil: null,
          isActive: true,
        });
      } else if (status === 'pagada') {
        await markListingReservation(order.listingId, {
          reservedBy: null,
          reservedUntil: null,
          isActive: false,
        });
      } else if (status === 'reservada') {
        await markListingReservation(order.listingId, {
          reservedBy: order.buyerId,
          reservedUntil: order.reservationExpiresAt,
          isActive: true,
        });
      }
    }

    await order.populate([
      { path: 'buyerId', select: 'name email role' },
      { path: 'sellerId', select: 'name email role' },
      { path: 'listingId' },
    ]);

    await ensureContactForOrder(order, req.user);

    return res.json({ order });
  } catch (err) {
    console.error('Error en PATCH /api/orders/:id/status:', err);
    return res.status(500).json({ message: 'Error al actualizar la orden' });
  }
});

module.exports = router;
