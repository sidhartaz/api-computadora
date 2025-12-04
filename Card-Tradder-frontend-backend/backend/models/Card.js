// Importa la librería mongoose, que se usa para definir esquemas y modelos de MongoDB
const mongoose = require('mongoose');

// Define un nuevo esquema de Mongoose llamado cardSchema
// Este esquema describe la estructura de los documentos "Card" en la colección de MongoDB
const cardSchema = new mongoose.Schema({
    // id de la carta (por ejemplo, el id que viene de la API externa de cartas)
    id: String,
    // nombre de la carta (ej: "Pikachu", "Charizard VMAX", etc.)
    name: String,
    // supertipo de la carta (ej: "Pokémon", "Trainer", "Energy")
    supertype: String,
    // arreglo de subtipos de la carta (ej: ["Basic"], ["Stage 1"], ["Trainer", "Supporter"])
    subtypes: [String],
    // arreglo de tipos de la carta (ej: ["Fire"], ["Water"], ["Electric"])
    types: [String],
    // rareza de la carta (ej: "Common", "Uncommon", "Rare", "Ultra Rare")
    rarity: String,
    // puntos de vida de la carta (HP), guardado como string (ej: "60", "120")
    hp: String,
    // objeto que almacena URLs de imágenes de la carta
    images: {
        // URL de la imagen pequeña
        small: String,
        // URL de la imagen grande
        large: String
    },
    // información del set/colección al que pertenece la carta
    set: {
        // id del set (según API externa o sistema propio)
        id: String,
        // nombre del set (ej: "Base Set", "Sword & Shield", etc.)
        name: String
    }
});

// Crea y exporta el modelo 'Card' a partir del esquema cardSchema
// Esto permite usar mongoose.model('Card') en otras partes del proyecto para interactuar con la colección
module.exports = mongoose.model('Card', cardSchema);
