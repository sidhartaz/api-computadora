// Carga las variables de entorno desde el archivo .env (si existe)
require('dotenv').config();
// Importa Mongoose para conectarse a MongoDB
const mongoose = require('mongoose');
// Importa bcrypt para hashear la contraseña del admin
const bcrypt = require('bcryptjs');
// Importa el modelo User para crear/buscar usuarios
const User = require('../models/User');

// Función principal del script
async function main() {
  // Toma la URI de Mongo desde las variables de entorno o usa la base local por defecto
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

  // Conecta a MongoDB usando la URI
  await mongoose.connect(mongoUri);
  console.log('✅ Conectado a MongoDB');

  // Toma el email desde los argumentos de la línea de comandos (node script.js email password)
  // Si no se pasa, usa 'admin@cardtrader.com' por defecto
  const email = process.argv[2] || 'admin@cardtrader.com';
  // Toma la contraseña desde argumentos; si no se pasa, usa 'admin123' por defecto
  const password = process.argv[3] || 'admin123';

  // Busca si ya existe un usuario con ese email
  let admin = await User.findOne({ email });
  if (admin) {
    // Si ya existe, muestra un mensaje y termina el script
    console.log('⚠️ Ya existe un usuario con ese email:', email);
    process.exit(0);
  }

  // Hashea la contraseña con factor de costo 10
  const hashed = await bcrypt.hash(password, 10);

  // Crea el usuario admin en la base de datos
  admin = await User.create({
    name: 'Administrador',  // Nombre visible
    email,                  // Email (el que se pasó por argumento o el por defecto)
    password: hashed,       // Contraseña hasheada
    role: 'admin',          // Rol de administrador
  });

  // Muestra por consola los datos del admin creado
  console.log('🎉 Admin creado con éxito:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Rol:   ${admin.role}`);
  // Termina el proceso con código 0 (éxito)
  process.exit(0);
}

// Ejecuta la función principal y captura errores
main().catch(err => {
  // Si ocurre un error, lo muestra por consola
  console.error('Error creando admin:', err);
  // Termina el proceso con código 1 (error)
  process.exit(1);
});
