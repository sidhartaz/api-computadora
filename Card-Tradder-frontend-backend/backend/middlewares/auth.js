// Importa la librería jsonwebtoken para manejar tokens JWT (firmar y verificar)
const jwt = require('jsonwebtoken');
// Define la clave secreta usada para firmar/verificar los JWT
// Si existe JWT_SECRET en variables de entorno, usa esa, si no, usa el string por defecto
const JWT_SECRET = process.env.JWT_SECRET || 'camilo7532';

// Middleware que exige que el usuario esté autenticado mediante un token JWT
function authRequired(req, res, next) {
  // Obtiene el encabezado Authorization de la petición (ej: "Bearer <token>")
  const authHeader = req.headers.authorization;

  // Si no hay encabezado o no comienza con "Bearer ", devuelve error 401 (no autorizado)
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  // Extrae el token dividiendo el string por espacio: ["Bearer", "<token>"] y toma la segunda parte
  const token = authHeader.split(' ')[1];

  try {
    // Verifica y decodifica el token usando la clave secreta
    // Si es válido, devuelve un payload (ej: { id, role, iat, exp })
    const payload = jwt.verify(token, JWT_SECRET); // { id, role, iat, exp }
    // Guarda el payload dentro de req.user para que los siguientes middlewares/controladores lo usen
    req.user = payload;
    // Llama a next() para continuar con el siguiente middleware o controlador
    next();
  } catch (err) {
    // Si hay error al verificar (token inválido, expirado, etc.), responde con 401
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

// Middleware de autorización por rol
// requireRole recibe uno o más roles permitidos (ej: requireRole('admin', 'vendedor'))
function requireRole(...roles) {
  // Devuelve un middleware que usará los roles de arriba
  return (req, res, next) => {
    // Si no hay usuario en req (no se autenticó) o su rol no está dentro de los permitidos
    if (!req.user || !roles.includes(req.user.role)) {
      // Devuelve 403 (prohibido) indicando que no tiene permisos
      return res.status(403).json({ message: 'No tienes permisos' });
    }
    // Si el rol es válido, continúa con el siguiente middleware/controlador
    next();
  };
}

// Exporta los middlewares para usarlos en las rutas (ej: router.get(..., authRequired, requireRole('admin')))
module.exports = { authRequired, requireRole };
