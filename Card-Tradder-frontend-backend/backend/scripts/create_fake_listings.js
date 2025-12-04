// scripts/create_fake_listings.js

// Importa Mongoose para conectarse a MongoDB y trabajar con modelos
const mongoose = require('mongoose');
// Importa faker (desde @faker-js/faker) para generar datos falsos realistas
const { faker } = require('@faker-js/faker');  // ← CORRECTO
// Importa bcrypt para hashear contraseñas de los usuarios falsos
const bcrypt = require('bcryptjs');
// Importa el modelo de cartas
const Card = require('../models/Card');
// Importa el modelo de usuarios
const User = require('../models/User');
// Importa el modelo de publicaciones/listings
const Listing = require('../models/Listing');

// URL de conexión a MongoDB
// Si existe la variable de entorno MONGO_URI la usa, si no, usa la base local "cardtrader"
const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

// Función principal del script (async para poder usar await)
async function main() {
  // Conecta a MongoDB usando la URL definida
  await mongoose.connect(MONGO);
  console.log('Conectado a MongoDB');

  // --------- CREAR VENDEDORES FALSOS COMO USUARIOS ---------

  // Array donde se guardarán los datos de los vendedores falsos
  const sellers = [];
  // Hashea la contraseña "password123" una vez para reutilizarla en todos los usuarios
  const password = await bcrypt.hash('password123', 10);

  // Crea 20 usuarios falsos con rol "vendedor"
  for (let i = 0; i < 20; i++) {
    sellers.push({
      // Nombre completo aleatorio
      name: faker.person.fullName(),
      // Email aleatorio
      email: faker.internet.email(),
      // Contraseña hasheada (la misma para todos: "password123")
      password,
      // Rol del usuario
      role: 'vendedor',
    });
  }

  // Inserta todos los vendedores en la colección User de MongoDB
  const createdSellers = await User.insertMany(sellers);
  console.log('Vendedores creados:', createdSellers.length);

  // --------- OBTENER CARTAS PARA GENERAR LISTINGS ---------

  // Busca hasta 500 cartas en la colección Card
  // .lean() devuelve objetos planos (mejor performance para solo lectura)
  const cards = await Card.find({}).limit(500).lean();

  // Array que almacenará las publicaciones/listings falsos
  const listings = [];

  // Recorre cada carta obtenida
  for (const card of cards) {
    // Genera un número aleatorio de listings por carta: 0, 1 o 2
    const count = Math.floor(Math.random() * 3); // 0 a 2 listings por carta

    // Crea "count" publicaciones para esta carta
    for (let i = 0; i < count; i++) {
      // Toma un vendedor aleatorio de la lista de sellers creados
      const seller = createdSellers[Math.floor(Math.random() * createdSellers.length)];

      // Agrega un nuevo listing al array
      listings.push({
        // id de la carta (campo "id" del modelo Card, no _id)
        cardId: card.id,
        // _id del vendedor (ObjectId)
        sellerId: seller._id,
        // Precio aleatorio entre 1000 y 200000 (como Number)
        price: Number(faker.commerce.price({ min: 1000, max: 200000 })),
        // Condición de la carta, elegida aleatoriamente de este arreglo
        condition: faker.helpers.arrayElement([
          'Near Mint',
          'Light Played',
          'Moderately Played',
          'Heavily Played',
        ]),
        // Descripción aleatoria tipo producto
        description: faker.commerce.productDescription(),
        // Estado: todas las publicaciones se crean como "aprobada"
        status: 'aprobada',
      });
    }
  }

  // Inserta todos los listings generados en la colección Listing
  await Listing.insertMany(listings);
  console.log('Listings creados:', listings.length);

  // Termina el proceso con código 0 (éxito)
  process.exit(0);
}

// Ejecuta la función principal y captura cualquier error
main().catch(err => {
  // Muestra el error en consola
  console.error(err);
  // Termina el proceso con código 1 (error)
  process.exit(1);
});
