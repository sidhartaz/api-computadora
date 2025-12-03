require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

  await mongoose.connect(mongoUri);
  console.log('✅ Conectado a MongoDB');

  const email = process.argv[2] || 'admin@cardtrader.com';
  const password = process.argv[3] || 'admin123';

  let admin = await User.findOne({ email });
  if (admin) {
    console.log('⚠️ Ya existe un usuario con ese email:', email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);

  admin = await User.create({
    name: 'Administrador',
    email,
    password: hashed,
    role: 'admin',
  });

  console.log('🎉 Admin creado con éxito:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Rol:   ${admin.role}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error creando admin:', err);
  process.exit(1);
});
