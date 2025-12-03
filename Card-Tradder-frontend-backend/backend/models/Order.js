const mongoose = require('mongoose');

const historySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pendiente', 'reservada', 'pagada', 'cancelada'],
      required: true,
    },
    note: { type: String },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['pagada', 'cancelada', 'reservada', 'info'],
      default: 'info',
    },
    message: { type: String, required: true },
    recipient: { type: String, enum: ['buyer', 'seller'], default: 'buyer' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    cardId: { type: String },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['compra', 'reserva'], default: 'compra' },
    status: {
      type: String,
      enum: ['pendiente', 'reservada', 'pagada', 'cancelada'],
      default: 'pendiente',
    },
    reservationExpiresAt: { type: Date },
    total: { type: Number },
    history: { type: [historySchema], default: [] },
    notes: { type: String },
    notifications: { type: [notificationSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
