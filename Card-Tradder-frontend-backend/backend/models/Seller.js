// models/Seller.js
// Importa Mongoose para definir esquemas y modelos
const mongoose = require('mongoose');

// Define el esquema para la colección "Seller" (vendedores)
const sellerSchema = new mongoose.Schema({
    // Nombre del vendedor
    name: String,
    // URL o ruta del avatar/imagen de perfil del vendedor
    avatar: String,
    // Rating o puntuación del vendedor (por ejemplo, de 1 a 5)
    rating: Number,
    // Fecha de creación del vendedor, por defecto la fecha actual
    createdAt: { type: Date, default: Date.now }
});

// Crea y exporta el modelo 'Seller' a partir de sellerSchema
// Esto permite usar mongoose.model('Seller') en otras partes del proyecto
module.exports = mongoose.model('Seller', sellerSchema);
