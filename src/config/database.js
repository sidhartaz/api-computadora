// src/config/database.js
const { Sequelize } = require('sequelize');
// Configuración de la conexión a MySQL
const sequelize = new Sequelize({
dialect: 'mysql', // Tipo de base de datos
host: 'localhost', // Donde está tu MySQL
port: 3306, // Puerto de MySQL
username: 'root', // Tu usuario de MySQL
password: '123456', // Tu contraseña de MySQL
database: 'computadoras', // Nombre de tu base de datos
// Configuraciones adicionales
logging: console.log, // Muestra las consultas SQL en consola
timezone: '-03:00', // Zona horaria de Chile
// Configuración del pool de conexiones
pool: {
max: 5, // Máximo 5 conexiones simultáneas
min: 0, // Mínimo 0 conexiones
acquire: 30000, // Tiempo máximo para obtener conexión
idle: 10000 // Tiempo antes de cerrar conexión inactiva
}
});
module.exports = sequelize;
