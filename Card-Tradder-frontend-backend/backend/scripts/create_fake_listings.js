// scripts/create_fake_listings.js
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');  // ← CORRECTO
const bcrypt = require('bcryptjs');
const Card = require('../models/Card');
const User = require('../models/User');
const Listing = require('../models/Listing');

const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

async function main() {
  await mongoose.connect(MONGO);
  console.log('Conectado a MongoDB');

  // Crear vendedores falsos como usuarios del sistema
  const sellers = [];
  const password = await bcrypt.hash('password123', 10);
  for (let i = 0; i < 20; i++) {
    sellers.push({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password,
      role: 'vendedor',
    });
  }

  const createdSellers = await User.insertMany(sellers);
  console.log('Vendedores creados:', createdSellers.length);

  // Obtener cartas
  const cards = await Card.find({}).limit(500).lean();

  const listings = [];

  for (const card of cards) {
    const count = Math.floor(Math.random() * 3); // 0 a 2 listings por carta

    for (let i = 0; i < count; i++) {
      const seller = createdSellers[Math.floor(Math.random() * createdSellers.length)];

      listings.push({
        cardId: card.id,
        sellerId: seller._id,
        price: Number(faker.commerce.price({ min: 1000, max: 200000 })),
        condition: faker.helpers.arrayElement([
          'Near Mint',
          'Light Played',
          'Moderately Played',
          'Heavily Played',
        ]),
        description: faker.commerce.productDescription(),
        status: 'aprobada',
      });
    }
  }

  await Listing.insertMany(listings);
  console.log('Listings creados:', listings.length);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
