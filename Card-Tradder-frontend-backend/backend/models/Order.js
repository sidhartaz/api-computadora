// Importa Mongoose para definir esquemas y modelos
const mongoose = require('mongoose');

// Subesquema para el historial de cambios de estado de una orden
const historySchema = new mongoose.Schema(
  {
    // Estado en ese momento del historial
    status: {
      type: String,
      // Solo permite estos valores como estado
      enum: ['pendiente', 'reservada', 'pagada', 'cancelada'],
      required: true,
    },
    // Nota opcional asociada al cambio (ej: motivo de cancelación)
    note: { type: String },
    // Usuario que hizo el cambio (admin, seller, etc.)
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Cuándo se hizo el cambio
    changedAt: { type: Date, default: Date.now },
  },
  // { _id: false } indica que estos subdocumentos no tendrán su propio _id
  { _id: false }
);

// Subesquema para notificaciones asociadas a una orden
const notificationSchema = new mongoose.Schema(
  {
    // Tipo de notificación (qué tipo de evento se informa)
    type: {
      type: String,
      enum: ['pagada', 'cancelada', 'reservada', 'info'],
      default: 'info',
    },
    // Mensaje de la notificación
    message: { type: String, required: true },
    // A quién va dirigida la notificación: comprador o vendedor
    recipient: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    // Fecha de creación de la notificación
    createdAt: { type: Date, default: Date.now },
  },
  // Igual que antes, sin _id propio para cada notificación
  { _id: false }
);

// Esquema principal de la orden
const orderSchema = new mongoose.Schema(
  {
    // Publicación/listing asociada a esta orden
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    // id de la carta (string que referencia al campo id de Card, no al _id)
    cardId: { type: String },
    // Vendedor (dueño del listing)
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Comprador (usuario que hace la reserva/compra)
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Tipo de orden: compra directa o reserva
    type: { type: String, enum: ['compra', 'reserva'], default: 'compra' },
    // Estado actual de la orden
    status: {
      type: String,
      enum: ['pendiente', 'reservada', 'pagada', 'cancelada'],
      default: 'pendiente',
    },
    // Fecha límite de la reserva (si es de tipo 'reserva')
    reservationExpiresAt: { type: Date },
    // Total de la orden (monto final)
    total: { type: Number },
    // Historial de cambios de estado, usando el subesquema historySchema
    history: { type: [historySchema], default: [] },
    // Notas adicionales sobre la orden (internas o visibles según el uso)
    notes: { type: String },
    // Notificaciones asociadas a la orden, usando notificationSchema
    notifications: { type: [notificationSchema], default: [] },
  },
  // { timestamps: true } agrega automáticamente createdAt y updatedAt al documento
  { timestamps: true }
);

// Índice para consultar rápidamente las órdenes de un comprador, ordenadas por fecha de creación
orderSchema.index({ buyerId: 1, createdAt: -1 });
// Índice para consultar rápidamente las órdenes de un vendedor, ordenadas por fecha de creación
orderSchema.index({ sellerId: 1, createdAt: -1 });
// Índice para buscar reservas por tipo, estado y fecha de expiración (útil para expirar reservas)
orderSchema.index({ type: 1, status: 1, reservationExpiresAt: 1 });

// Crea y exporta el modelo 'Order' para usarlo en el resto de la app
module.exports = mongoose.model('Order', orderSchema);
