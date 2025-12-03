const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Card = require("./models/Card");

const MONGO_URI = "mongodb://127.0.0.1:27017/cardtrader";

async function importCards() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("Conectado a MongoDB");

        // Carpeta donde están los JSON
const cardsFolder = path.join(__dirname, "projects", "pokemon-tcg-data", "cards", "en");

        const files = fs.readdirSync(cardsFolder);
        console.log(`Encontrados ${files.length} archivos de sets.`);

        let totalInserted = 0;

        for (const file of files) {
            if (!file.endsWith(".json")) continue;

            const filePath = path.join(cardsFolder, file);
            const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

            if (!json || !json.length) continue;

            const docs = json.map(card => ({
                id: card.id,
                name: card.name,
                supertype: card.supertype,
                subtypes: card.subtypes,
                types: card.types,
                rarity: card.rarity,
                hp: card.hp,
                images: {
                    small: card.images?.small,
                    large: card.images?.large,
                },
                set: {
                    id: card.set?.id,
                    name: card.set?.name,
                }
            }));

            await Card.insertMany(docs, { ordered: false }).catch(err => {});

            totalInserted += docs.length;
            console.log(`Importado set: ${file} (${docs.length} cartas)`);
        }

        console.log("======================================");
        console.log(`IMPORTACIÓN COMPLETA: ${totalInserted} CARTAS`);
        console.log("======================================");

        mongoose.connection.close();
    } catch (error) {
        console.error("Error:", error);
        mongoose.connection.close();
    }
}

importCards();
