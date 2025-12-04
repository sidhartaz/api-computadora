// Constante que representa un día en milisegundos:
// 24 horas * 60 minutos * 60 segundos * 1000 ms
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Función que expira (cancela) reservas antiguas
// Recibe los modelos Order y Listing como parámetros para no acoplar el módulo a imports directos
async function expireOldReservations(Order, Listing) {
  // Fecha y hora actuales
  const now = new Date();

  // Busca órdenes que cumplan TODAS estas condiciones:
  // - type: 'reserva'      → solo órdenes de tipo reserva
  // - status: 'reservada'  → ya aprobadas como reserva
  // - reservationExpiresAt <= now → la fecha de expiración ya pasó
  const staleOrders = await Order.find({
    type: 'reserva',
    status: 'reservada',
    reservationExpiresAt: { $lte: now },
  });

  // Recorre cada orden vencida
  for (const order of staleOrders) {
    // Cambia el estado de la orden a 'cancelada'
    order.status = 'cancelada';

    // Agrega una entrada al historial explicando la razón de la cancelación
    order.history.push({
      status: 'cancelada',
      note: 'Reserva auto-cancelada por no confirmar pago en 24 horas',
      // Se registra que el cambio lo hace el vendedor (lógicamente, aunque sea automático)
      changedBy: order.sellerId,
    });

    // Agrega una notificación para el comprador informando la cancelación automática
    order.notifications.push({
      type: 'cancelada',
      message: 'Reserva cancelada automáticamente por no confirmar el pago a tiempo.',
      recipient: 'buyer',
    });

    // Guarda los cambios en la orden en la base de datos
    await order.save();

    // Actualiza la publicación asociada:
    // - isActive: true       → vuelve a estar visible
    // - reservedBy: null     → ya no hay comprador que la tenga reservada
    // - reservedUntil: null  → limpia la fecha de reserva
    await Listing.findByIdAndUpdate(order.listingId, {
      $set: { isActive: true, reservedBy: null, reservedUntil: null },
    });
  }
}

// Exporta la función y la constante para usarlas en controladores u otros módulos
module.exports = { expireOldReservations, DAY_IN_MS };
