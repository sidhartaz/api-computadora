// Importa el módulo 'fs' para trabajar con el sistema de archivos (leer directorios, archivos, etc.)
const fs = require("fs");
// Importa 'path' para construir rutas de archivos/carpetas de forma segura según el SO
const path = require("path");
// Importa Mongoose para conectarse a MongoDB
const mongoose = require("mongoose");
// Importa el modelo Card para guardar las cartas en la base de datos
const Card = require("./models/Card");

// Cadena de conexión a MongoDB (en este script usas el localhost directamente)
const MONGO_URI = "mongodb://127.0.0.1:27017/cardtrader";

// Función principal para importar las cartas desde archivos JSON
async function importCards() {
    try {
        // Conecta a MongoDB usando la URI definida
        await mongoose.connect(MONGO_URI);
        console.log("Conectado a MongoDB");

        // Carpeta donde están los JSON de cartas
        // __dirname = carpeta actual donde está este script
        // Luego se navega a projects/pokemon-tcg-data/cards/en
        const cardsFolder = path.join(__dirname, "projects", "pokemon-tcg-data", "cards", "en");

        // Lee todos los nombres de archivo dentro de esa carpeta
        const files = fs.readdirSync(cardsFolder);
        console.log(`Encontrados ${files.length} archivos de sets.`);

        // Contador total de cartas "insertadas" (en realidad, procesadas)
        let totalInserted = 0;

        // Recorre cada archivo encontrado en la carpeta
        for (const file of files) {
            // Si el archivo no termina en ".json", se lo salta
            if (!file.endsWith(".json")) continue;

            // Construye la ruta completa del archivo JSON
            const filePath = path.join(cardsFolder, file);
            // Lee el contenido del archivo como texto y luego lo parsea a JSON
            const json = JSON.parse(fs.readFileSync(filePath, "utf8"));

            // Si el JSON está vacío o no es un array con elementos, se lo salta
            if (!json || !json.length) continue;

            // Mapea cada carta del JSON a la estructura esperada por el modelo Card
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

            // Inserta todas las cartas en la colección Card
            // { ordered: false } = si alguna falla (ej: duplicado), sigue con las demás
            // El catch vacío ignora el error para que no detenga todo el proceso
            await Card.insertMany(docs, { ordered: false }).catch(err => {});

            // Suma la cantidad de documentos generados a la cuenta total
            totalInserted += docs.length;
            console.log(`Importado set: ${file} (${docs.length} cartas)`);
        }

        // Muestra resumen final en consola
        console.log("======================================");
        console.log(`IMPORTACIÓN COMPLETA: ${totalInserted} CARTAS`);
        console.log("======================================");

        // Cierra la conexión con MongoDB
        mongoose.connection.close();
    } catch (error) {
        // Si algo falla en el proceso, muestra el error
        console.error("Error:", error);
        // Cierra la conexión de todas formas
        mongoose.connection.close();
    }
}

// Llama a la función principal para ejecutar el script
importCards();
