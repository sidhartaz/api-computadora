// Importa la librería oficial de Redis para Node.js
const redis = require('redis');

// Crea un cliente de Redis
// Se configura usando variables de entorno o valores por defecto
const client = redis.createClient({
  socket: {
    // Host de Redis: si existe REDIS_HOST en .env lo usa, si no, 127.0.0.1 (localhost)
    host: process.env.REDIS_HOST || '127.0.0.1',
    // Puerto de Redis: si existe REDIS_PORT lo convierte a Number, si no, usa 6379
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  },
});

// Maneja el evento de error del cliente de Redis
client.on('error', (err) => {
  // Si ocurre un error de conexión o similar, se muestra en consola
  console.error('Redis error:', err.message);
});

// Función asíncrona para conectar el cliente a Redis
async function connectRedis() {
  // Solo se conecta si el cliente todavía no está abierto
  if (!client.isOpen) {
    await client.connect();
    console.log('✅ Conectado a Redis (cliente Node)');
  }
}

// Exporta el cliente y la función para conectar
// - client: se usa para hacer operaciones (get, set, etc.)
// - connectRedis: se llama en server.js para iniciar la conexión al arrancar la app
module.exports = { client, connectRedis };
