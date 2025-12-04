// Importa Express para crear el router de rutas
const express = require('express');
// Importa Mongoose para validar ObjectId y otros helpers
const mongoose = require('mongoose');
// Importa middleware para exigir autenticación
const { authRequired } = require('../middlewares/auth');
// Importa el modelo de publicaciones/listings
const Listing = require('../models/Listing');
// Importa el modelo de órdenes
const Order = require('../models/Order');
// Importa función que expira reservas antiguas y constante de un día en milisegundos
const { expireOldReservations, DAY_IN_MS } = require('../utils/reservations');
// Importa el modelo de cartas
const Card = require('../models/Card');
// Importa el modelo de usuarios
const User = require('../models/User');

// Crea una instancia de router de Express
const router = express.Router();
// Número de horas que dura una reserva por defecto
const DEFAULT_RESERVATION_HOURS = 24;

// Helper para paginación
function getPagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  // Página actual: toma query.page, la parsea a entero y se asegura que sea al menos 1
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  // Tamaño de página: toma query.limit, aplica mínimo 1, máximo maxLimit
  const pageSize = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);

  // Devuelve page, pageSize y el número de documentos a saltar (skip)
  return { page, pageSize, skip: (page - 1) * pageSize };
}

// Normaliza un id que puede venir como ObjectId, objeto o string
function normalizeId(value) {
  // Si no hay valor, devuelve null
  if (!value) return null;
  // Si es un objeto y tiene _id, retorna el _id como string
  if (typeof value === 'object' && value._id) return value._id.toString();
  // En otro caso, lo convierte directo a string
  return value.toString();
}

// Determina si un usuario puede ver el contacto de la publicación asociada a una orden
function canSeeListingContact(order, user) {
  // Si la orden no tiene listingId, no puede ver nada
  if (!order?.listingId) return false;

  // Los admins siempre pueden ver el contacto
  if (user.role === 'admin') return true;

  // Si el usuario es el vendedor de la orden, también puede ver el contacto
  const sellerId = normalizeId(order.sellerId);
  if (sellerId && sellerId === user.id) return true;

  // Verifica si el usuario es el comprador
  const buyerId = normalizeId(order.buyerId);
  // isReservationOwner indica si es una reserva y el comprador es el usuario actual
  const isReservationOwner = order.type === 'reserva' && buyerId === user.id;

  // Estados de la orden en los que se permite ver el contacto
  const allowedStatuses = ['reservada', 'pagada'];

  // Solo si es dueño de la reserva y el estado está permitido, puede ver el contacto
  return isReservationOwner && allowedStatuses.includes(order.status);
}

// Asegura que la orden tenga o no el contacto visible según los permisos del usuario
async function ensureContactForOrder(order, user) {
  // Si la orden no tiene listingId, simplemente la devuelve
  if (!order?.listingId) return order;

  // Verifica si el usuario puede ver el contacto
  const canSee = canSeeListingContact(order, user);

  // Si NO puede ver el contacto, lo oculta
  if (!canSee) {
    // Si listingId tiene contactWhatsapp definido, lo quitamos
    if (order.listingId.contactWhatsapp !== undefined) {
      // Convierte listingId a objeto plano si es un documento de Mongoose
      const listingData = typeof order.listingId.toObject === 'function'
        ? order.listingId.toObject()
        : order.listingId;

      // Sobrescribe listingId, dejando contactWhatsapp undefined
      order.listingId = { ...listingData, contactWhatsapp: undefined };
    }

    // Devuelve la orden con el contacto oculto
    return order;
  }

  // Si SÍ puede ver el contacto:
  // Normaliza listingId a objeto plano
  const listingData = typeof order.listingId.toObject === 'function'
    ? order.listingId.toObject()
    : order.listingId;

  // Si la publicación no tiene contactWhatsapp, intenta obtenerlo desde el usuario vendedor
  if (!listingData.contactWhatsapp) {
    const sellerId = normalizeId(order.sellerId);
    if (sellerId) {
      // Busca el vendedor y toma su contactWhatsapp
      const seller = await User.findById(sellerId).select('contactWhatsapp').lean();
      if (seller?.contactWhatsapp) {
        listingData.contactWhatsapp = seller.contactWhatsapp;
      }
    }
  }

  // Actualiza listingId con los datos completos
  order.listingId = listingData;
  return order;
}

// Actualiza el estado de reserva en una publicación
async function markListingReservation(listingId, { reservedBy = null, reservedUntil = null, isActive }) {
  // Arma el objeto de actualización
  const update = {
    reservedBy,
    reservedUntil,
  };

  // Si isActive viene como booleano, también lo incluye en el update
  if (typeof isActive === 'boolean') {
    update.isActive = isActive;
  }

  // Aplica la actualización a la publicación correspondiente
  await Listing.findByIdAndUpdate(listingId, {
    $set: update,
  });
}

// Adjunta datos de la carta a cada orden (buscando por cardId)
async function attachCardData(orders) {
  // Extrae todos los cardId distintos de las órdenes (filtrando los falsy)
  const cardIds = [
    ...new Set(
      orders
        .map((order) => order.cardId)
        .filter(Boolean)
    ),
  ];

  // Si no hay cardIds, simplemente devuelve las órdenes tal como están
  if (!cardIds.length) return orders;

  // Busca las cartas asociadas a esos cardIds
  const cards = await Card.find({ id: { $in: cardIds } }).lean();
  // Crea un mapa id de carta -> carta completa
  const cardMap = new Map(cards.map((card) => [card.id, card]));

  // Retorna las órdenes enriquecidas con:
  // - order.card (objeto de carta)
  // - listingId.card (para que la publicación también tenga la carta si aplica)
  return orders.map((order) => ({
    ...order,
    card: cardMap.get(order.cardId) || null,
    listingId:
      order.listingId && typeof order.listingId === 'object'
        ? {
            ...order.listingId,
            card: order.listingId.card || cardMap.get(order.cardId) || null,
          }
        : order.listingId,
  }));
}

// Crear una orden o reserva
router.post('/', authRequired, async (req, res) => {
  try {
    // Extrae listingId, el tipo de orden (compra/reserva) y nota opcional del cuerpo
    const { listingId, type = 'compra', note } = req.body;

    // listingId es obligatorio
    if (!listingId) {
      return res.status(400).json({ message: 'listingId es obligatorio' });
    }

    // Valida que listingId sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(listingId)) {
      return res.status(400).json({ message: 'El identificador de la publicación no es válido.' });
    }

    // Expira reservas antiguas antes de continuar
    await expireOldReservations(Order, Listing);

    // Busca la publicación asociada a listingId
    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing no encontrado' });
    }

    // La publicación debe estar aprobada para generar una orden
    if (listing.status !== 'aprobada') {
      return res.status(400).json({ message: 'La publicación debe estar aprobada para generar una orden' });
    }

    // Calcula fecha de hace una semana
    const weekAgo = new Date(Date.now() - 7 * DAY_IN_MS);
    // Cuenta cuántas órdenes (no canceladas) ha creado el usuario en la última semana
    const weeklyOrders = await Order.countDocuments({
      buyerId: req.user.id,
      status: { $ne: 'cancelada' },
      createdAt: { $gte: weekAgo },
    });

    // Límite de 7 compras o reservas por semana
    if (weeklyOrders >= 7) {
      return res.status(400).json({ message: 'Solo puedes crear 7 compras o reservas por semana.' });
    }

    // Normaliza el tipo de orden: si type es 'reserva' lo deja como reserva, si no, 'compra'
    const normalizedType = type === 'reserva' ? 'reserva' : 'compra';

    // Solo usuarios con rol 'cliente' pueden crear reservas
    if (normalizedType === 'reserva' && req.user.role !== 'cliente') {
      return res.status(403).json({ message: 'Solo los clientes pueden crear reservas.' });
    }

    // Verifica si ya existe una reserva activa o pendiente para esa publicación
    const activeReservation = await Order.findOne({
      listingId,
      type: 'reserva',
      status: { $in: ['reservada', 'pendiente', 'pagada'] },
    });

    // Si ya hay una reserva, bloquea la creación según el tipo
    if (activeReservation) {
      const message =
        normalizedType === 'reserva'
          ? 'Esta publicación ya cuenta con una reserva activa.'
          : 'La publicación tiene una reserva pendiente o activa en este momento.';

      return res.status(400).json({ message });
    }

    // Si la publicación no está activa, no se pueden crear nuevas órdenes o reservas
    if (!listing.isActive) {
      return res.status(400).json({ message: 'La publicación no está disponible para nuevas órdenes o reservas.' });
    }

    // Estado inicial de la orden
    const initialStatus = 'pendiente';

    // Obtiene el comprador para incluir su nombre en una posible notificación
    const buyer = await User.findById(req.user.id).select('name');
    // Arreglo de notificaciones a crear junto con la orden
    const notifications = [];
    // Por defecto, sin fecha de expiración de reserva (se manejará después)
    const reservationExpiresAt = null;

    // Si es una reserva, se crea una notificación para el vendedor
    if (normalizedType === 'reserva') {
      notifications.push({
        type: 'info',
        message: `${buyer?.name || 'El cliente'} ha solicitado una reserva para tu publicación "${listing.name}"`,
        recipient: 'seller',
      });
    }

    // Crea la orden con todos los datos correspondientes
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

    // Popula referencias para devolver la orden completa
    await order.populate([
      { path: 'buyerId', select: 'name email role' },
      { path: 'sellerId', select: 'name email role' },
      { path: 'listingId' },
    ]);

    // Aplica lógica de ocultar/mostrar contacto según permisos
    await ensureContactForOrder(order, req.user);

    // Devuelve la orden creada
    return res.status(201).json({ order });
  } catch (err) {
    // Loguea el error en consola
    console.error('Error en POST /api/orders:', err);
    // Devuelve error 500 con mensaje y detalle
    return res.status(500).json({ message: 'Error al crear la orden', detail: err.message });
  }
});

// Listar órdenes (según rol)
router.get('/', authRequired, async (req, res) => {
  try {
    // Expira reservas antiguas antes de listar
    await expireOldReservations(Order, Listing);

    // Filtro base vacío
    const filter = {};
    const { status, type } = req.query;
    // Si viene status en la query, se agrega al filtro
    if (status) filter.status = status;

    // Si viene type, valida y agrega al filtro
    if (type) {
      const allowedTypes = ['compra', 'reserva'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Tipo de orden inválido' });
      }
      filter.type = type;
    }

    // Filtrado según rol del usuario:
    if (req.user.role === 'admin') {
      // Admin ve todas las órdenes (sin filtro adicional)
    } else if (req.user.role === 'vendedor') {
      // Vendedor ve solo las órdenes donde él es el seller
      filter.sellerId = req.user.id;
    } else {
      // Cliente ve solo las órdenes donde él es el buyer
      filter.buyerId = req.user.id;
    }

    // Obtiene datos de paginación
    const { page, pageSize, skip } = getPagination(req.query, { defaultLimit: 30, maxLimit: 200 });

    // Ejecuta en paralelo:
    // 1) Buscar órdenes con filtros, populate, sort y paginación
    // 2) Contar total de órdenes que cumplen el filtro
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('buyerId', 'name email role')
        .populate('sellerId', 'name email role')
        .populate('listingId')
        .populate('history.changedBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Order.countDocuments(filter),
    ]);

    // Enriquecemos las órdenes con datos de cartas
    const enrichedOrders = await attachCardData(orders);
    // Sanitizamos el contacto según permisos para cada orden
    const sanitized = await Promise.all(
      enrichedOrders.map((order) => ensureContactForOrder(order, req.user))
    );

    // Devolvemos órdenes y paginación
    return res.json({
      orders: sanitized,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (err) {
    // Loguea error
    console.error('Error en GET /api/orders:', err);
    // Devuelve error 500
    return res.status(500).json({ message: 'Error al listar órdenes' });
  }
});

// Detalle de una orden
router.get('/:id', authRequired, async (req, res) => {
  try {
    // Expira reservas antiguas
    await expireOldReservations(Order, Listing);

    // Busca la orden por ID y popula buyer, seller, listing y el history.changedBy
    const order = await Order.findById(req.params.id)
      .populate('buyerId', 'name email role')
      .populate('sellerId', 'name email role')
      .populate('listingId')
      .populate('history.changedBy', 'name email role')
      .lean();

    // Si no existe la orden, 404
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    // Determina si el usuario actual es comprador, vendedor o admin
    const isBuyer = order.buyerId?._id?.toString() === req.user.id;
    const isSeller = order.sellerId?._id?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Si no es ninguno de los tres, no puede ver esta orden
    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).json({ message: 'No tienes permiso para ver esta orden' });
    }

    // Adjunta datos de cartas a esta orden
    const [orderWithCard] = await attachCardData([order]);
    // Aplica la lógica de contacto según permisos
    const sanitized = await ensureContactForOrder(orderWithCard, req.user);

    // Devuelve la orden
    return res.json({ order: sanitized });
  } catch (err) {
    // Loguea error
    console.error('Error en GET /api/orders/:id:', err);
    // Error genérico
    return res.status(500).json({ message: 'Error al obtener la orden' });
  }
});

// Actualizar estado (pago, cancelación, etc.)
router.patch('/:id/status', authRequired, async (req, res) => {
  try {
    // Extrae el nuevo estado y nota opcional del body
    const { status, note } = req.body;
    // Estados permitidos
    const allowedStatuses = ['pendiente', 'reservada', 'pagada', 'cancelada'];

    // Si el estado no es válido, error 400
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Estado inválido' });
    }

    // Busca la orden por ID
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Orden no encontrada' });

    // Determina roles sobre esta orden
    const isSeller = order.sellerId.toString() === req.user.id;
    const isBuyer = order.buyerId.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Solo el vendedor puede aprobar la reserva; admin puede gestionar otros estados
    if (status === 'reservada' && !isSeller) {
      return res.status(403).json({ message: 'Solo el vendedor puede aprobar una reserva.' });
    }

    // Si no es vendedor ni admin:
    // el comprador solo puede cancelar su propia orden
    if (!isSeller && !isAdmin) {
      if (!(isBuyer && status === 'cancelada')) {
        return res.status(403).json({ message: 'No tienes permiso para cambiar este estado' });
      }
    }

    // Indica si la orden es de tipo reserva
    const wasReservation = order.type === 'reserva';

    // Actualiza el estado de la orden
    order.status = status;
    // Agrega entrada al historial de la orden
    order.history.push({
      status,
      note: note || `Estado actualizado a ${status}`,
      changedBy: req.user.id,
    });

    // Si era una reserva que pasa a 'reservada' y no tiene aún fecha de expiración,
    // se le asignan DEFAULT_RESERVATION_HOURS horas a partir de ahora
    if (wasReservation && status === 'reservada' && !order.reservationExpiresAt) {
      order.reservationExpiresAt = new Date(Date.now() + DEFAULT_RESERVATION_HOURS * 60 * 60 * 1000);
    }

    // Determina si el vendedor está notificando pago/cancelación
    const sellerNotifyingPayment = isSeller && ['pagada', 'cancelada'].includes(status);
    // Indica si se acaba de aprobar una reserva
    const reservationApproved = wasReservation && status === 'reservada' && isSeller;

    // Si se aprobó la reserva, se genera notificación para el comprador
    if (reservationApproved) {
      order.notifications.push({
        type: 'reservada',
        message: 'Tu reserva fue aprobada. Tienes 24 horas para confirmar el pago.',
        recipient: 'buyer',
      });
    }

    // Si el vendedor marcó la orden como pagada o cancelada, se notifica al comprador
    if (sellerNotifyingPayment) {
      order.notifications.push({
        type: status,
        message: `La orden fue marcada como ${status} por el vendedor.`,
        recipient: 'buyer',
      });
    }

    // Guarda cambios en la orden
    await order.save();

    // Si la orden era una reserva, se actualiza el estado de la publicación relacionada
    if (wasReservation) {
      if (status === 'cancelada') {
        // Reserva cancelada: la publicación vuelve a estar activa y sin reserva
        await markListingReservation(order.listingId, {
          reservedBy: null,
          reservedUntil: null,
          isActive: true,
        });
      } else if (status === 'pagada') {
        // Reserva pagada: la publicación deja de estar activa
        await markListingReservation(order.listingId, {
          reservedBy: null,
          reservedUntil: null,
          isActive: false,
        });
      } else if (status === 'reservada') {
        // Reserva aprobada: se marca quién reservó y hasta cuándo
        await markListingReservation(order.listingId, {
          reservedBy: order.buyerId,
          reservedUntil: order.reservationExpiresAt,
          isActive: true,
        });
      }
    }

    // Popula campos antes de devolver la orden actualizada
    await order.populate([
      { path: 'buyerId', select: 'name email role' },
      { path: 'sellerId', select: 'name email role' },
      { path: 'listingId' },
    ]);

    // Aplica reglas de contacto según permisos
    await ensureContactForOrder(order, req.user);

    // Devuelve la orden actualizada
    return res.json({ order });
  } catch (err) {
    // Loguea error
    console.error('Error en PATCH /api/orders/:id/status:', err);
    // Devuelve error 500
    return res.status(500).json({ message: 'Error al actualizar la orden' });
  }
});

// Exporta el router para usarlo en el archivo principal (server.js)
module.exports = router;
