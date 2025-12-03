const redis = require('redis');

const client = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  },
});

client.on('error', (err) => {
  console.error('Redis error:', err.message);
});

async function connectRedis() {
  if (!client.isOpen) {
    await client.connect();
    console.log('✅ Conectado a Redis (cliente Node)');
  }
}

module.exports = { client, connectRedis };
