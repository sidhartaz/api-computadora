// Importa Mongoose para definir esquemas y modelos para MongoDB
const mongoose = require('mongoose');

// Define el esquema de la colección "User" (usuarios del sistema)
const userSchema = new mongoose.Schema({
  // Nombre del usuario, obligatorio
  name:  { type: String, required: true },

  // Email del usuario, obligatorio y único (no se pueden repetir correos)
  email: { type: String, required: true, unique: true },

  // Contraseña del usuario (se guarda hasheada en el controlador, no en texto plano)
  password: { type: String, required: true },

  // Rol del usuario dentro de la plataforma
  role: {
    type: String,
    // Solo puede ser uno de estos valores
    enum: ['cliente', 'vendedor', 'admin'],
    // Si no se especifica, por defecto será "cliente"
    default: 'cliente'
  },

  // Número de WhatsApp de contacto del usuario (opcional)
  contactWhatsapp: { type: String },

  // Indica si el usuario está activo o no
  // Se puede usar para "eliminar" lógicamente un usuario sin borrarlo de la BD
  isActive: { type: Boolean, default: true }, // 👈 para “eliminar” lógicamente si quieres

  // Fecha de creación del usuario, por defecto la fecha actual
  createdAt: { type: Date, default: Date.now }
});

// Crea y exporta el modelo 'User' basado en userSchema
// Luego podrás usar: const User = require('./models/User');
module.exports = mongoose.model('User', userSchema);
