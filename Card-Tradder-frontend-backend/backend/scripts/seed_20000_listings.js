// scripts/seed_20000_listings.js

// Carga variables de entorno desde .env (si existe)
require('dotenv').config();
// Importa Mongoose para conectarse a MongoDB y trabajar con modelos
const mongoose = require('mongoose');
// Importa bcrypt para hashear contraseñas
const bcrypt = require('bcryptjs');
// Importa faker para generar datos falsos
const { faker } = require('@faker-js/faker');

// Importa el modelo de usuarios
const User = require('../models/User');
// Importa el modelo de publicaciones/listings
const Listing = require('../models/Listing');
// Importa el modelo de cartas
const Card = require('../models/Card');

// URI de MongoDB: usa MONGO_URI de entorno o una BD local por defecto
const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

// Cantidades de datos de prueba que se van a generar
const TOTAL_SELLERS = 200;      // vendedores falsos
const TOTAL_CLIENTES = 500;     // clientes falsos
const TOTAL_LISTINGS = 20000;   // publicaciones para pruebas

// Función principal del script
async function main() {
  // Conecta a MongoDB
  await mongoose.connect(MONGO);
  console.log('✅ Conectado a MongoDB:', MONGO);

  // ⚠️ Si quieres limpiar antes, descomenta:
  // await Listing.deleteMany({});
  // await User.deleteMany({ role: { $in: ['cliente', 'vendedor'] } });

  // Hashea la contraseña que usarán TODOS los usuarios falsos
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1) Crear vendedores
  const vendedoresDocs = [];
  for (let i = 0; i < TOTAL_SELLERS; i++) {
    vendedoresDocs.push({
      // Nombre falso completo
      name: faker.person.fullName(),
      // Email controlado para identificar que son vendedores falsos
      email: `vendedor${i}@fake.com`,
      // Contraseña hasheada
      password: passwordHash,
      // Rol vendedor
      role: 'vendedor',
      // Teléfono de WhatsApp falso con formato chileno
      contactWhatsapp: faker.phone.number('+56 9 ########'),
      // Usuario activo
      isActive: true,
    });
  }

  // 2) Crear clientes
  const clientesDocs = [];
  for (let i = 0; i < TOTAL_CLIENTES; i++) {
    clientesDocs.push({
      // Nombre falso completo
      name: faker.person.fullName(),
      // Email controlado para clientes falsos
      email: `cliente${i}@fake.com`,
      // Contraseña hasheada (la misma para todos)
      password: passwordHash,
      // Rol cliente
      role: 'cliente',
      // Teléfono de WhatsApp falso
      contactWhatsapp: faker.phone.number('+56 9 ########'),
      // Usuario activo
      isActive: true,
    });
  }

  console.log('👤 Insertando usuarios falsos (vendedores + clientes)...');
  // Inserta vendedores y clientes en la colección User
  const usuarios = await User.insertMany([...vendedoresDocs, ...clientesDocs]);
  // Filtra los _id de aquellos usuarios cuyo rol es 'vendedor'
  const vendedoresIds = usuarios.filter(u => u.role === 'vendedor').map(u => u._id);
  console.log(`   → ${vendedoresIds.length} vendedores creados.`);
  console.log(`   → ${usuarios.length - vendedoresIds.length} clientes creados.`);

  // 3) Obtener algunas cartas (si ya tienes cards cargadas en la BD)
  const cards = await Card.find().limit(500);
  // Extrae el campo "id" de las cartas, no el _id de Mongo
  const cardIds = cards.map(c => c.id);
  console.log(`🃏 Cartas encontradas en colección Card: ${cardIds.length}`);

  // Posibles condiciones/estados físicos de las cartas
  const condiciones = ['nuevo', 'como nuevo', 'bueno', 'jugado', 'para repuesto'];

  // 4) Crear 20.000 listings
  const listings = [];
  for (let i = 0; i < TOTAL_LISTINGS; i++) {
    // Elige al azar un vendedor entre la lista de vendedores creados
    const sellerId = faker.helpers.arrayElement(vendedoresIds);

    // Variables para vincular la carta
    let cardId = undefined;
    let baseName = '';

    // Si hay cartas en la colección, usa una al azar
    if (cardIds.length > 0) {
      cardId = faker.helpers.arrayElement(cardIds);
      // Nombre base que incluye el id de la carta
      baseName = `Carta Pokémon ${cardId}`;
    } else {
      // Si no hay cartas en la BD, usa un nombre de producto genérico
      baseName = faker.commerce.productName();
    }

    // Nombre completo del listing (incluye un índice para evitar repetidos)
    const name = `${baseName} #${i}`;
    // Base del slug: versión "slugificada" del nombre en minúsculas
    const slugBase = faker.helpers.slugify(name.toLowerCase());
    // Slug final: base + índice + timestamp para asegurar unicidad
    const slug = `${slugBase}-${i}-${Date.now()}`; // para asegurar unicidad

    // Agrega al array un nuevo listing falso
    listings.push({
      sellerId,                                 // vendedor dueño del listing
      cardId,                                   // id de la carta (puede ser undefined)
      name,                                     // nombre del listing
      slug,                                     // slug único
      price: faker.number.int({ min: 500, max: 200000 }), // precio aleatorio
      condition: faker.helpers.arrayElement(condiciones), // condición al azar
      description: faker.lorem.sentence({ min: 5, max: 20 }), // descripción corta
      imageData: null,                          // sin imagen (podrías cambiar esto)
      status: 'aprobada',                       // se crean ya aprobadas
      isActive: true,                           // activas
      createdAt: faker.date.past({ years: 1 }), // fecha aleatoria dentro del último año
    });

    // Solo para mostrar progreso cada 5000 listings generados
    if ((i + 1) % 5000 === 0) {
      console.log(`   → ${i + 1} listings generados...`);
    }
  }

  console.log('📦 Insertando listings en MongoDB...');
  // Inserta todos los listings de golpe en la colección Listing
  await Listing.insertMany(listings);
  console.log(`✅ Listo: ${listings.length} listings creados.`);

  // Desconecta de MongoDB
  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
  // Termina el proceso con código 0 (éxito)
  process.exit(0);
}

// Ejecuta la función principal y captura errores
main().catch(err => {
  console.error('❌ Error en seed_20000_listings:', err);
  process.exit(1);
});

// node scripts/seed_20000_listings.js // ejecutar // Password123!
// ↑ Comentario recordatorio de cómo ejecutar el script y qué password se usó
