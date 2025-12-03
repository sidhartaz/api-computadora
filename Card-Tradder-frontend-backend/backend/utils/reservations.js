const DAY_IN_MS = 24 * 60 * 60 * 1000;

async function expireOldReservations(Order, Listing) {
  const now = new Date();
  const staleOrders = await Order.find({
    type: 'reserva',
    status: 'reservada',
    reservationExpiresAt: { $lte: now },
  });

  for (const order of staleOrders) {
    order.status = 'cancelada';
    order.history.push({
      status: 'cancelada',
      note: 'Reserva auto-cancelada por no confirmar pago en 24 horas',
      changedBy: order.sellerId,
    });
    order.notifications.push({
      type: 'cancelada',
      message: 'Reserva cancelada automáticamente por no confirmar el pago a tiempo.',
      recipient: 'buyer',
    });

    await order.save();

    await Listing.findByIdAndUpdate(order.listingId, {
      $set: { isActive: true, reservedBy: null, reservedUntil: null },
    });
  }
}

module.exports = { expireOldReservations, DAY_IN_MS };
