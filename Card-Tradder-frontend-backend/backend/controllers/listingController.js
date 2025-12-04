const mongoose = require('mongoose');
const Card = require('../models/Card');
const Listing = require('../models/Listing');
const Order = require('../models/Order');
const User = require('../models/User');
const { generateUniqueSlug } = require('../utils/slug');
const { stripContactInfo } = require('../utils/listings');
const { expireOldReservations } = require('../utils/reservations');

function getPagination(query = {}, { defaultLimit = 50, maxLimit = 100 } = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), maxLimit);

  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function getApprovedListings(req, res) {
  try {
    await expireOldReservations(Order, Listing);

    const filter = { status: 'aprobada', isActive: true };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const { page, pageSize, skip } = getPagination(req.query, { defaultLimit: 48, maxLimit: 200 });

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('sellerId', 'name email role')
        .lean(),
      Listing.countDocuments(filter),
    ]);

    const cardIds = [...new Set(listings.map((lst) => lst.cardId).filter(Boolean))];
    const cards = await Card.find({ id: { $in: cardIds } }).lean();
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    const enriched = listings.map((lst) => ({
      ...stripContactInfo(lst),
      card: cardMap.get(lst.cardId) || null,
    }));

    return res.json({
      items: enriched,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
    });
  } catch (error) {
    console.error('Error en GET /api/listings:', error);
    return res.status(500).json({ message: 'Error del servidor' });
  }
}

async function getMyListings(req, res) {
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
}

async function getFeaturedListing(req, res) {
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
}

async function getListingById(req, res) {
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
}

async function getListingContact(req, res) {
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
      status: { $in: ['reservada', 'pagada'] },
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
}

async function createListing(req, res) {
  try {
    const { cardId, price, condition, description, imageData, name, contactWhatsapp } = req.body;

    if (!name || price === undefined || !condition) {
      return res.status(400).json({ message: 'Faltan datos: name, price, condition' });
    }

    const slug = await generateUniqueSlug(Listing, name);

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
      sellerId: req.user.id,
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
}

async function updateListing(req, res) {
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
      listing.slug = await generateUniqueSlug(Listing, name, listing._id);
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
}

async function deleteListing(req, res) {
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
}

module.exports = {
  createListing,
  deleteListing,
  getApprovedListings,
  getFeaturedListing,
  getListingById,
  getListingContact,
  getMyListings,
  updateListing,
};
