// Importa Mongoose, que se usa para definir esquemas y modelos para MongoDB
const mongoose = require('mongoose');

// Define el esquema de la colección "Listing" (publicaciones/anuncios)
const listingSchema = new mongoose.Schema({
  // Referencia opcional a la carta (id proveniente de la colección Card, campo "id", no "_id")
  cardId: { type: String },

  // Usuario vendedor que publica la carta
  // Es un ObjectId que referencia al modelo 'User' y es obligatorio
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Datos de la publicación
  // Nombre de la publicación (o de la carta, si no se vincula a Card)
  name: { type: String, required: true, trim: true },
  // Slug único para la URL (ej: "charizard-vmax-123"), obligatorio, único e indexado
  slug: { type: String, required: true, unique: true, index: true },
  // Precio de la publicación, obligatorio (Number)
  price: { type: Number, required: true },
  // Condición/estado de la carta (ej: "Near Mint", "Played", etc.), obligatorio
  condition: { type: String, required: true },
  // Descripción adicional de la publicación
  description: { type: String },
  // Datos de imagen, por ejemplo un base64 o URL según tu implementación
  imageData: { type: String },
  // Contador de cuántas veces aparece en búsquedas (para destacar más buscadas)
  searchCount: { type: Number, default: 0 },
  // Número de WhatsApp asociado específicamente a esta publicación (puede sobreescribir el del usuario)
  contactWhatsapp: { type: String },

  // Estado de validación por parte de admin
  status: {
    type: String,
    // Solo permite estos tres valores como estado
    enum: ['pendiente', 'aprobada', 'rechazada'],
    // Valor por defecto: pendiente (cuando el vendedor crea el listing)
    default: 'pendiente',
  },
  // Razón del rechazo, si el admin marca la publicación como 'rechazada'
  rejectionReason: { type: String },

  // Indica si la publicación está activa (visible) o no
  isActive: { type: Boolean, default: true },
  // Usuario que tiene la publicación reservada (si aplica)
  reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Fecha hasta la cual la reserva es válida
  reservedUntil: { type: Date },
  // Fecha de creación de la publicación, por defecto ahora
  createdAt: { type: Date, default: Date.now },
});

// Índice compuesto para optimizar consultas de listings públicos:
// Filtrando por status, isActive y ordenando por createdAt descendente
listingSchema.index({ status: 1, isActive: 1, createdAt: -1 });
// Índice para listar rápidamente las publicaciones de un vendedor ordenadas por fecha
listingSchema.index({ sellerId: 1, createdAt: -1 });
// Índice para consultas por carta y estado (por ejemplo, mostrar todas las publicaciones de una carta)
listingSchema.index({ cardId: 1, status: 1 });

// Crea y exporta el modelo 'Listing' basado en listingSchema
module.exports = mongoose.model('Listing', listingSchema);
