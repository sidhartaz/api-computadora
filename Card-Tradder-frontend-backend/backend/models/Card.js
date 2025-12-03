const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
    id: String,
    name: String,
    supertype: String,
    subtypes: [String],
    types: [String],
    rarity: String,
    hp: String,
    images: {
        small: String,
        large: String
    },
    set: {
        id: String,
        name: String
    }
});

module.exports = mongoose.model('Card', cardSchema);
