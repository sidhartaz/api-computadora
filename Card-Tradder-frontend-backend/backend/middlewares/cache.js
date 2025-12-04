// Importa el cliente de Redis desde el módulo redisClient, renombrándolo como redisClient
const { client: redisClient } = require('../redisClient');

// Middleware para cachear las búsquedas de cartas
async function cacheCardsSearch(req, res, next) {
  try {
    // Toma el parámetro "q" de la query (texto de búsqueda), o cadena vacía si no viene, y le aplica trim()
    const query = (req.query.q || '').trim();
    // Obtiene el número de página desde query.page; por defecto 1, asegurando que sea al menos 1
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    // Obtiene el límite desde query.limit; si no viene o es inválido, queda 0, y luego se usa 20 por defecto
    const limit = Math.max(parseInt(req.query.limit, 10) || 0, 0) || 20;

    // Si no hay query de búsqueda, no tiene sentido cachear, pasa al siguiente middleware/controlador
    if (!query) {
      return next();
    }

    // Construye una clave única para cachear según:
    // - texto de búsqueda en minúsculas
    // - número de página
    // - límite de resultados
    // Ejemplo: "cards:search:charizard:p1:l20"
    const cacheKey = `cards:search:${query.toLowerCase()}:p${page}:l${limit}`;

    // Intenta obtener desde Redis una respuesta previamente guardada con esa cacheKey
    const cached = await redisClient.get(cacheKey);
    // Si existe algo cacheado...
    if (cached) {
      // Marca en la cabecera de la respuesta que fue un HIT de cache
      res.setHeader('X-Cache', 'HIT');
      // Devuelve directamente el JSON parseado desde Redis, sin consultar la base de datos
      return res.json(JSON.parse(cached));
    }

    // Si no había nada en cache:
    // Guarda la cacheKey en res.locals para que el controlador (searchCards) pueda usarla
    // y guardar ahí la respuesta al final
    res.locals.cacheKey = cacheKey;
    // Continúa al siguiente middleware/controlador
    next();
  } catch (err) {
    // Si hay error al usar Redis o procesar, se loguea en consola
    console.error('Error en cacheCardsSearch:', err.message);
    // Aún así se continúa el flujo normal sin cache (no se rompe la API por culpa del cache)
    next();
  }
}

// Exporta el middleware para usarlo en las rutas (ej: router.get('/cards/search', cacheCardsSearch, searchCards))
module.exports = { cacheCardsSearch };
