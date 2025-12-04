// scripts/seed_20000_listings_real_users.js

// Carga las variables de entorno desde el archivo .env (si existe)
require('dotenv').config();
// Importa Mongoose para conectarte a MongoDB
const mongoose = require('mongoose');
// Importa bcrypt para hashear contraseñas
const bcrypt = require('bcryptjs');
// Importa faker para generar datos falsos (usuarios, textos, etc.)
const { faker } = require('@faker-js/faker');

// Importa el modelo de usuario
const User = require('../models/User');
// Importa el modelo de publicaciones/listings
const Listing = require('../models/Listing');
// Importa el modelo de cartas
const Card = require('../models/Card');

// Usa la misma URI que tu app
// Si existe MONGO_URI en variables de entorno la usa, si no usa la BD local "cardtrader"
const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

// Configuración
// Cantidad de vendedores falsos a crear si no existen vendedores reales
const TOTAL_FAKE_SELLERS_IF_EMPTY = 200;   // solo si no hay vendedores reales
// Cantidad total de publicaciones/listings a generar
const TOTAL_LISTINGS = 20000;              // publicaciones a generar

// Asegura que existan vendedores en la BD; si no hay, crea falsos
async function ensureSellers(passwordHash) {
  console.log('🔎 Buscando vendedores existentes (role: "vendedor")...');
  // Busca usuarios cuyo rol sea 'vendedor'
  let sellers = await User.find({ role: 'vendedor' });

  // Si ya existen vendedores, los devuelve y no crea nuevos
  if (sellers.length > 0) {
    console.log(`✅ Vendedores existentes encontrados: ${sellers.length}`);
    return sellers;
  }

  // Si no hay vendedores, crea vendedores falsos
  console.log('⚠️ No hay vendedores existentes. Creando vendedores falsos...');

  // Array para acumular documentos de vendedores falsos
  const vendedoresDocs = [];
  // Genera TOTAL_FAKE_SELLERS_IF_EMPTY usuarios falsos
  for (let i = 0; i < TOTAL_FAKE_SELLERS_IF_EMPTY; i++) {
    vendedoresDocs.push({
      // Nombre falso
      name: faker.person.fullName(),
      // Email controlado para identificar que son generados automáticamente
      email: `vendedor_auto${i}@fake.com`,
      // Contraseña ya hasheada (se pasa como parámetro passwordHash)
      password: passwordHash,
      // Rol de vendedor
      role: 'vendedor',
      // Número de Whatsapp falso con formato +56 9 ########
      contactWhatsapp: faker.phone.number('+56 9 ########'),
      // Usuario marcado como activo
      isActive: true,
    });
  }

  // Inserta todos los vendedores falsos en la colección User
  const inserted = await User.insertMany(vendedoresDocs);
  console.log(`✅ Vendedores falsos creados: ${inserted.length}`);
  // Devuelve los vendedores recién creados
  return inserted;
}

// Función principal del script
async function main() {
  // Conecta a MongoDB usando la URI configurada
  await mongoose.connect(MONGO);
  console.log('✅ Conectado a MongoDB:', MONGO);

  // Genera un hash de la contraseña que usarán los vendedores falsos
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1) Asegurar vendedores (usar reales si existen; si no, crear falsos)
  const sellers = await ensureSellers(passwordHash);
  // Arreglo solo con los _id de los vendedores
  const sellerIds = sellers.map(s => s._id);

  // 2) Obtener algunas cartas si existen en la colección Card
  const cards = await Card.find().limit(500);
  // Extrae el campo "id" de las cartas (no el _id)
  const cardIds = cards.map(c => c.id);
  console.log(`🃏 Cartas encontradas en colección Card: ${cardIds.length}`);

  // Condiciones posibles para las cartas (estado físico)
  const condiciones = ['nuevo', 'como nuevo', 'bueno', 'jugado', 'para repuesto'];

  // 3) Generar 20.000 listings
  const listings = [];
  for (let i = 0; i < TOTAL_LISTINGS; i++) {
    // Elige un vendedor aleatorio de la lista de sellers
    const sellerId = faker.helpers.arrayElement(sellerIds);

    // Variables para cardId y nombre base del listing
    let cardId = undefined;
    let baseName = '';

    // Si hay cartas en la colección Card...
    if (cardIds.length > 0) {
      // Elige un id de carta aleatorio
      cardId = faker.helpers.arrayElement(cardIds);
      // Usa un nombre base que incluya el id de la carta
      baseName = `Carta Pokémon ${cardId}`;
    } else {
      // Si no hay cartas, usa un nombre genérico de producto
      baseName = faker.commerce.productName();
    }

    // Nombre final del listing, añadiendo un índice para evitar repetidos
    const name = `${baseName} #${i}`;
    // Base para el slug (slugify del nombre en minúsculas)
    const slugBase = faker.helpers.slugify(name.toLowerCase());
    // Slug único añadiendo índice e instante actual
    const slug = `${slugBase}-${i}-${Date.now()}`;

    // Agrega un nuevo listing falso al array
    listings.push({
      sellerId,           // vendedor aleatorio
      cardId,             // id de carta (puede ser undefined si no hay cartas)
      name,               // nombre completo del listing
      slug,               // slug único
      price: faker.number.int({ min: 500, max: 200000 }), // precio aleatorio
      condition: faker.helpers.arrayElement(condiciones), // condición aleatoria
      description: faker.lorem.sentence({ min: 5, max: 20 }), // descripción al azar
      imageData: null,    // sin imagen (puedes cambiarlo si quieres cargar algo real)
      status: 'aprobada', // se crean como aprobadas
      isActive: true,     // activas
      createdAt: faker.date.past({ years: 1 }), // fecha aleatoria del último año
    });

    // Cada 5000 listings generados, muestra un avance en consola
    if ((i + 1) % 5000 === 0) {
      console.log(`   → ${i + 1} listings generados...`);
    }
  }

  console.log('📦 Insertando listings en MongoDB...');
  // Inserta todos los listings generados en la colección Listing
  await Listing.insertMany(listings);
  console.log(`✅ Listo: ${listings.length} listings creados.`);

  // Desconecta de MongoDB
  await mongoose.disconnect();
  console.log('🔌 Desconectado de MongoDB');
  // Termina el proceso con código 0 (éxito)
  process.exit(0);
}

// Ejecuta la función main y captura cualquier error
main().catch(err => {
  console.error('❌ Error en seed_20000_listings_real_users:', err);
  process.exit(1);
});

// node scripts/seed_20000_listings_real_users.js // ejecutar // Password123!
// ↑ Comentario recordatorio de cómo ejecutar el script desde la terminal
//   y la contraseña que se está usando para los vendedores falsos.
