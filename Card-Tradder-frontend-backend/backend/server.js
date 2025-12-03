const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const adminRoutes = require('./routes/admin.routes');
const orderRoutes = require('./routes/orders.routes');
const { expireOldReservations } = require('./utils/reservations');

const { authRequired, requireRole } = require('./middlewares/auth');
const { client: redisClient, connectRedis } = require('./redisClient');

// Cargar variables de entorno
dotenv.config();

// Inicializar app
const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. MIDDLEWARES ---
app.use(express.json({ limit: '5mb' }));                          // Para JSON (Postman, fetch, etc.)
app.use(express.urlencoded({ extended: true, limit: '5mb' }));  // Por si envías formularios
app.use(express.static(path.join(__dirname, '..', 'frontend', 'public')));

// --- 2. IMPORTAR MODELOS ---
const User = require('./models/User');
const Card = require('./models/Card');
const Listing = require('./models/Listing');
const Order = require('./models/Order');

// --- 3. CONEXIÓN A BASE DE DATOS ---
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cardtrader';

function slugifyBase(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function generateUniqueSlug(name, excludeId = null) {
  const base = slugifyBase(name) || 'publicacion';
  let candidate = base;
  let suffix = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Listing.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();

    if (!existing) {
      return candidate;
    }

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

function stripContactInfo(listing) {
  if (!listing) return listing;
  const { contactWhatsapp, ...rest } = listing;
  return rest;
}

const mongoConnection = mongoose
  .connect(mongoUri)
  .then(() => console.log('✅ Base de Datos MongoDB conectada'))
  .catch((err) => {
    console.error('❌ ERROR DE CONEXIÓN A MONGO DB:');
    console.error('   Verifica que MongoDB esté corriendo y que la variable MONGO_URI en tu archivo .env sea correcta.');
    console.error('   Detalle:', err.message);
    process.exit(1);
  });

// Conectar a Redis (no detiene la app si falla)
connectRedis().catch((err) => {
  console.error('No se pudo conectar a Redis:', err.message);
});

// --- 4. RUTAS DE AUTENTICACIÓN ---

// Registro
app.post('/api/register', async (req, res) => {
  console.log('📩 Registro:', req.body.email);
  const { name, email, password, role, contactWhatsapp } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'El correo ya existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const validRoles = ['cliente', 'vendedor', 'admin'];
    const finalRole = validRoles.includes(role) ? role : 'cliente';

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: finalRole,
      contactWhatsapp,
    });

    await newUser.save();

    console.log('✅ Usuario creado:', email);
    return res.status(201).json({
      message: 'Usuario registrado con éxito.',
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        contactWhatsapp: newUser.contactWhatsapp,
      },
    });
  } catch (error) {
    console.error('Error registro:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Login con JWT
app.post('/api/login', async (req, res) => {
  console.log('🔑 Login body recibido:', req.body);

  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Faltan email o contraseña' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'camilo7532';

    // Creamos el token con id y role
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactWhatsapp: user.contactWhatsapp,
      },
    });
  } catch (error) {
    console.error('Error login:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// --- 5. ENDPOINTS PROTEGIDOS DE EJEMPLO (para probar JWT + ROLES) ---

// Cualquier usuario autenticado (cliente o vendedor)
app.get('/api/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role contactWhatsapp');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json({
      message: 'Usuario autenticado',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        contactWhatsapp: user.contactWhatsapp,
      },
    });
  } catch (err) {
    console.error('Error en GET /api/me:', err);
    return res.status(500).json({ message: 'Error al recuperar el usuario' });
  }
});

// Actualizar perfil propio (nombre y WhatsApp)
app.patch('/api/me', authRequired, async (req, res) => {
  try {
    const { name, contactWhatsapp } = req.body || {};

    const updates = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'El nombre no puede estar vacío.' });
      }
      updates.name = name.trim();
    }

    if (contactWhatsapp !== undefined) {
      updates.contactWhatsapp = contactWhatsapp ? contactWhatsapp.trim() : undefined;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No se enviaron cambios para actualizar.' });
    }

    const updated = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select(
      'name email role contactWhatsapp'
    );

    if (!updated) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    return res.json({
      message: 'Perfil actualizado con éxito',
      user: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        contactWhatsapp: updated.contactWhatsapp,
      },
    });
  } catch (error) {
    console.error('Error en PATCH /api/me:', error);
    return res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
});

// Solo administradores (rol "admin") pueden acceder
app.get('/api/admin/ventas', authRequired, requireRole('admin'), (req, res) => {
  res.json({
    message: 'Solo administradores pueden ver esta información',
  });
});

// --- 6. CRUD LISTINGS (recurso principal) ---

// Obtener todas las publicaciones aprobadas y activas (catálogo)
app.get('/api/listings', async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const filter = { status: 'aprobada', isActive: true };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const listings = await Listing.find(filter)
      .populate('sellerId', 'name email role')
      .lean();

    const cardIds = [...new Set(listings.map((lst) => lst.cardId).filter(Boolean))];
    const cards = await Card.find({ id: { $in: cardIds } }).lean();
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    const enriched = listings.map((lst) => ({
      ...stripContactInfo(lst),
      card: cardMap.get(lst.cardId) || null,
    }));

    return res.json(enriched);
  } catch (error) {
    console.error('Error en GET /api/listings:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener todas las publicaciones del vendedor (incluyendo inactivas o reservadas)
app.get('/api/listings/mine', authRequired, requireRole('vendedor'), async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const listings = await Listing.find({ sellerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('sellerId', 'name email role')
      .lean();

    const cardIds = [...new Set(listings.map((lst) => lst.cardId).filter(Boolean))];
    const cards = await Card.find({ id: { $in: cardIds } }).lean();
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    const enriched = listings.map((lst) => ({
      ...lst,
      card: cardMap.get(lst.cardId) || null,
    }));

    return res.json({ listings: enriched });
  } catch (error) {
    console.error('Error en GET /api/listings/mine:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener la publicación destacada por búsquedas
app.get('/api/listings/featured', async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const featured = await Listing.findOne({ status: 'aprobada', isActive: true })
      .sort({ searchCount: -1, createdAt: -1 })
      .populate('sellerId', 'name email role')
      .lean();

    if (!featured) {
      return res.json({ listing: null });
    }

    const card = featured.cardId ? await Card.findOne({ id: featured.cardId }).lean() : null;

    return res.json({
      listing: {
        ...stripContactInfo(featured),
        card,
      },
    });
  } catch (error) {
    console.error('Error en GET /api/listings/featured:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener una publicación por ID
app.get('/api/listings/:id', async (req, res) => {
  try {
    await expireOldReservations(Order, Listing);

    const listing = await Listing.findById(req.params.id)
      .populate('sellerId', 'name email role')
      .lean();

    if (!listing) {
      return res.status(404).json({ message: 'Listing no encontrado' });
    }

    if (listing.status !== 'aprobada') {
      return res.status(403).json({ message: 'La publicación aún no está aprobada.' });
    }

    if (!listing.isActive) {
      return res.status(403).json({ message: 'La publicación no está disponible.' });
    }

    return res.json(stripContactInfo(listing));
  } catch (error) {
    console.error('Error en GET /api/listings/:id:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

app.get('/api/listings/:id/contact', authRequired, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Identificador de publicación inválido.' });
    }

    await expireOldReservations(Order, Listing);

    const listing = await Listing.findById(id).lean();
    if (!listing) {
      return res.status(404).json({ message: 'Publicación no encontrada' });
    }

    const isSeller = listing.sellerId?.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    const isReservedByUser = listing.reservedBy?.toString() === req.user.id;

    const hasActiveReservation = await Order.exists({
      listingId: id,
      buyerId: req.user.id,
      type: 'reserva',
      status: { $in: ['pendiente', 'reservada', 'pagada'] },
    });

    if (!isSeller && !isAdmin && !hasActiveReservation && !isReservedByUser) {
      return res
        .status(403)
        .json({ message: 'Solo el comprador con una reserva activa puede ver el contacto del vendedor.' });
    }

    let contactWhatsapp = listing.contactWhatsapp;

    if (!contactWhatsapp && listing.sellerId) {
      const seller = await User.findById(listing.sellerId).select('contactWhatsapp').lean();
      contactWhatsapp = seller?.contactWhatsapp;
    }

    if (!contactWhatsapp) {
      return res
        .status(404)
        .json({ message: 'El vendedor aún no ha agregado un número de WhatsApp para esta publicación.' });
    }

    return res.json({ contactWhatsapp });
  } catch (error) {
    console.error('Error en GET /api/listings/:id/contact:', error);
    return res.status(500).json({ message: 'Error al obtener el contacto de la publicación' });
  }
});

// Crear una publicación (solo vendedores)
app.post('/api/listings', authRequired, requireRole('vendedor'), async (req, res) => {
  try {
    const { cardId, price, condition, description, imageData, name, contactWhatsapp } = req.body;

    if (!name || price === undefined || !condition) {
      return res.status(400).json({ message: 'Faltan datos: name, price, condition' });
    }

    const slug = await generateUniqueSlug(name);

    let sellerContact = contactWhatsapp;
    if (sellerContact === undefined) {
      const seller = await User.findById(req.user.id).select('contactWhatsapp');
      sellerContact = seller?.contactWhatsapp;
    }

    const newListing = new Listing({
      cardId,
      name,
      slug,
      price,
      condition,
      description,
      imageData,
      contactWhatsapp: sellerContact,
      sellerId: req.user.id, // del token JWT
      status: 'pendiente',
    });

    await newListing.save();

    return res.status(201).json({
      message: 'Listing creado con éxito',
      listing: newListing,
    });
  } catch (error) {
    console.error('Error en POST /api/listings:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Actualizar una publicación (solo vendedores dueños de la publicación)
app.put('/api/listings/:id', authRequired, requireRole('vendedor'), async (req, res) => {
  try {
    const { price, condition, description, imageData, name, contactWhatsapp } = req.body;

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing no encontrado' });
    }

    if (listing.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No puedes editar publicaciones de otros vendedores' });
    }

    if (price !== undefined) listing.price = price;
    if (condition !== undefined) listing.condition = condition;
    if (description !== undefined) listing.description = description;
    if (imageData !== undefined) listing.imageData = imageData;
    if (contactWhatsapp !== undefined) listing.contactWhatsapp = contactWhatsapp;
    if (req.body.cardId !== undefined) listing.cardId = req.body.cardId || undefined;
    if (name !== undefined) {
      listing.name = name;
      listing.slug = await generateUniqueSlug(name, listing._id);
    }

    await listing.save();

    return res.json({
      message: 'Listing actualizado con éxito',
      listing,
    });
  } catch (error) {
    console.error('Error en PUT /api/listings/:id:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// Eliminar una publicación (solo vendedores dueños de la publicación)
app.delete('/api/listings/:id', authRequired, requireRole('vendedor'), async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing no encontrado' });
    }

    if (listing.sellerId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'No puedes eliminar publicaciones de otros vendedores' });
    }

    await Order.deleteMany({ listingId: listing._id });
    await listing.deleteOne();

    return res.json({ message: 'Listing eliminado con éxito' });
  } catch (error) {
    console.error('Error en DELETE /api/listings/:id:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
});

// --- 7. MIDDLEWARE DE CACHE PARA /api/cards/search ---

async function cacheCardsSearch(req, res, next) {
  try {
    const query = req.query.q || '';

    if (!query) {
      return next(); // sin query, nada que cachear
    }

    const cacheKey = `cards:search:${query.toLowerCase()}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

    // Guardamos la key para después
    res.locals.cacheKey = cacheKey;
    next();
  } catch (err) {
    console.error('Error en cacheCardsSearch:', err.message);
    next(); // si Redis falla, seguimos normal
  }
}

// --- 8. RUTAS DE CARTAS ---

// Buscar cartas por nombre (para el catálogo / buscador) con cache
app.get('/api/cards/search', cacheCardsSearch, async (req, res) => {
  try {
    const query = req.query.q || '';

    if (!query) {
      return res.json({ results: [] });
    }

    const regex = { $regex: query, $options: 'i' };

    const cards = await Card.find({ name: regex }).limit(20).lean();
    const cardIds = cards.map((card) => card.id);

    const listingsForCards = await Listing.find({
      status: 'aprobada',
      cardId: { $in: cardIds },
    })
      .populate('sellerId', 'name email role')
      .lean();

    const resultsMap = new Map();

    for (const card of cards) {
      resultsMap.set(card.id, { card, listings: [] });
    }

    for (const lst of listingsForCards) {
      const key = lst.cardId || `listing-${lst._id}`;
      if (!resultsMap.has(key)) {
        resultsMap.set(key, { card: null, listings: [] });
      }
      const entry = resultsMap.get(key);
      entry.listings.push({
        id: lst._id,
        price: lst.price,
        condition: lst.condition,
        seller: lst.sellerId,
        imageData: lst.imageData,
        name: lst.name,
        cardId: lst.cardId,
        slug: lst.slug,
      });
    }

    const listingsByName = await Listing.find({ status: 'aprobada', name: regex })
      .populate('sellerId', 'name email role')
      .lean();

    const searchListingIds = new Set([
      ...listingsForCards.map((lst) => lst._id.toString()),
      ...listingsByName.map((lst) => lst._id.toString()),
    ]);

    const extraCardIds = listingsByName
      .map((lst) => lst.cardId)
      .filter((id) => id && !resultsMap.has(id));

    if (extraCardIds.length) {
      const extraCards = await Card.find({ id: { $in: extraCardIds } }).lean();
      for (const card of extraCards) {
        if (!resultsMap.has(card.id)) {
          resultsMap.set(card.id, { card, listings: [] });
        }
      }
    }

    for (const lst of listingsByName) {
      const key = lst.cardId || `listing-${lst._id}`;
      if (!resultsMap.has(key)) {
        resultsMap.set(key, { card: null, listings: [] });
      }
      const entry = resultsMap.get(key);
      entry.listings.push({
        id: lst._id,
        price: lst.price,
        condition: lst.condition,
        seller: lst.sellerId,
        imageData: lst.imageData,
        name: lst.name,
        cardId: lst.cardId,
        slug: lst.slug,
      });
    }

    const responseBody = { results: Array.from(resultsMap.values()) };

    if (searchListingIds.size) {
      try {
        await Listing.updateMany(
          { _id: { $in: Array.from(searchListingIds) } },
          { $inc: { searchCount: 1 } }
        );
      } catch (err) {
        console.error('No se pudo incrementar searchCount:', err.message);
      }
    }

    // Guardar en cache para próximas llamadas
    if (res.locals.cacheKey) {
      try {
        await redisClient.set(
          res.locals.cacheKey,
          JSON.stringify(responseBody),
          { EX: 60 } // 60 segundos
        );
      } catch (err) {
        console.error('Error guardando en Redis:', err.message);
      }
      res.setHeader('X-Cache', 'MISS');
    }

    return res.json(responseBody);
  } catch (error) {
    console.error('Error en /api/cards/search:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Autocomplete (para sugerencias de nombres desde el frontend)
app.get('/api/cards/autocomplete', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json([]);

    const items = await Card.find({
      name: new RegExp('^' + q, 'i'),
    })
      .limit(8)
      .select('id name images')
      .lean();

    return res.json(items);
  } catch (error) {
    console.error('Error en /api/cards/autocomplete:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Detalle de una carta por id TCG (ej: base1-58, xy7-54, etc.)
app.get('/api/cards/:id', async (req, res) => {
  try {
    const cardId = req.params.id;

    const card = await Card.findOne({ id: cardId }).lean();
    if (!card) {
      return res.json({ card: null, listings: [] });
    }

    const listings = await Listing.find({ cardId, status: 'aprobada', isActive: true })
      .populate('sellerId', 'name email role')
      .lean();

    const formattedListings = listings.map((lst) => ({
      id: lst._id,
      price: lst.price,
      condition: lst.condition,
      seller: lst.sellerId,
      imageData: lst.imageData,
      status: lst.status,
      isActive: lst.isActive,
      reservedBy: lst.reservedBy,
      reservedUntil: lst.reservedUntil,
    }));

    return res.json({
      card,
      listings: formattedListings,
    });
  } catch (error) {
    console.error('Error en /api/cards/:id:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
// --- 9. RUTA FALLBACK (para que cualquier ruta del frontend cargue index.html) ---
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'public', 'index.html'));
});

// --- 10. INICIAR SERVIDOR ---
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = { app, mongoConnection };
