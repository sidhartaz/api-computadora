const Card = require('../models/Card');
const Listing = require('../models/Listing');
const { client: redisClient } = require('../redisClient');

async function searchCards(req, res) {
  try {
    const query = (req.query.q || '').trim();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    if (!query) {
      return res.json({
        results: [],
        pagination: { page: 1, totalPages: 1, total: 0, limit },
      });
    }

    const regex = { $regex: query, $options: 'i' };

    const cards = await Card.find({ name: regex })
      .select('id name images set')
      .sort({ name: 1 })
      .lean();
    const cardIds = cards.map((card) => card.id);

    const listingsForCards = await Listing.find({
      status: 'aprobada',
      cardId: { $in: cardIds },
      isActive: { $ne: false },
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

    const listingsByName = await Listing.find({ status: 'aprobada', name: regex, isActive: { $ne: false } })
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

    const allResults = Array.from(resultsMap.values());
    const total = allResults.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const responseBody = {
      results: allResults.slice(start, start + limit),
      pagination: { page: safePage, totalPages, total, limit },
    };

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

    if (res.locals.cacheKey) {
      try {
        await redisClient.set(res.locals.cacheKey, JSON.stringify(responseBody), { EX: 60 });
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
}

async function autocompleteCards(req, res) {
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
}

async function getCardDetails(req, res) {
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
}

module.exports = {
  autocompleteCards,
  getCardDetails,
  searchCards,
};
