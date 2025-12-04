// Importa Express para crear el servidor HTTP y definir rutas/middlewares
const express = require('express');
// Importa path para resolver rutas de archivos/directorios de forma segura
const path = require('path');
// Importa Mongoose para conectarse y trabajar con MongoDB
const mongoose = require('mongoose');
// Importa dotenv para cargar variables de entorno desde un archivo .env
const dotenv = require('dotenv');
// Importa las rutas del panel de administración
const adminRoutes = require('./routes/admin.routes');
// Importa las rutas relacionadas con órdenes
const orderRoutes = require('./routes/orders.routes');
// Importa las rutas de autenticación (login, register, perfil)
const authRoutes = require('./routes/auth.routes');
// Importa las rutas de publicaciones/listings
const listingRoutes = require('./routes/listings.routes');
// Importa las rutas de cartas
const cardRoutes = require('./routes/cards.routes');
// Importa la función para conectar con Redis
const { connectRedis } = require('./redisClient');

// Carga las variables de entorno desde el archivo .env al objeto process.env
dotenv.config();

// Crea una instancia de aplicación Express
const app = express();
// Define el puerto: toma PORT de las variables de entorno o usa 3000 por defecto
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON del body de las peticiones
// limit: '5mb' → limita el tamaño máximo del body a 5 MB
app.use(express.json({ limit: '5mb' }));
// Middleware para parsear datos de formularios (x-www-form-urlencoded)
// extended: true permite objetos anidados
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
// Sirve archivos estáticos desde la carpeta frontend/public
// Esto permite servir el frontend (HTML, CSS, JS, imágenes, etc.)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// URI de conexión a MongoDB
// Si existe MONGO_URI en .env la usa; de lo contrario, usa la BD local
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

// Inicia la conexión a MongoDB con Mongoose
// Guarda la promesa en mongoConnection (por si se necesita en tests)
const mongoConnection = mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ Base de Datos MongoDB conectada'))
  .catch((err) => {
    // Si falla la conexión, muestra un mensaje claro en consola
    console.error('❌ ERROR DE CONEXIÓN A MONGO DB:');
    console.error('   Verifica que MongoDB esté corriendo y que la variable MONGO_URI en tu archivo .env sea correcta.');
    console.error('   Detalle:', err.message);
    // Corta la ejecución del proceso con código 1 (error)
    process.exit(1);
  });

// Intenta conectar con Redis usando el helper connectRedis
connectRedis().catch((err) => {
  // Si no se puede conectar, muestra mensaje pero no detiene el servidor
  console.error('No se pudo conectar a Redis:', err.message);
});

// Monta las rutas de autenticación bajo el prefijo /api
// Ejemplo: /api/register, /api/login, /api/me
app.use('/api', authRoutes);
// Monta las rutas de publicaciones/listings bajo /api/listings
// Ejemplo: /api/listings/, /api/listings/mine, etc.
app.use('/api/listings', listingRoutes);
// Monta las rutas de cartas bajo /api/cards
// Ejemplo: /api/cards/search, /api/cards/autocomplete, /api/cards/:id
app.use('/api/cards', cardRoutes);
// Monta las rutas de administración bajo /api/admin
// Ejemplo: /api/admin/users, /api/admin/publications, etc.
app.use('/api/admin', adminRoutes);
// Monta las rutas de órdenes bajo /api/orders
// Ejemplo: /api/orders/, /api/orders/:id, etc.
app.use('/api/orders', orderRoutes);

// Ruta "catch-all" para el frontend (Single Page Application)
// Cualquier GET que no haya matcheado rutas anteriores devuelve index.html
// Esto permite que el router del frontend (React, etc.) maneje la navegación
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

// Solo inicia el servidor HTTP si NO estamos en modo test
// En tests, se importa 'app' sin levantar el servidor
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

// Exporta la app (para tests) y la promesa de conexión a Mongo
module.exports = { app, mongoConnection };
