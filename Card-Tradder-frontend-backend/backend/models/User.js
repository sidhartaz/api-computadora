const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['cliente', 'vendedor', 'admin'],
    default: 'cliente'
  },
  contactWhatsapp: { type: String },
  isActive: { type: Boolean, default: true }, // 👈 para “eliminar” lógicamente si quieres
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
