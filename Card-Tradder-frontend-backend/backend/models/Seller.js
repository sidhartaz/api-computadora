// models/Seller.js
const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
    name: String,
    avatar: String,
    rating: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Seller', sellerSchema);
