// src/app.js
const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');

// Importar rutas
const clienteRoutes = require('./routes/clienteRoutes');
const productoRoutes = require('./routes/productoRoutes');
const pedidoRoutes = require('./routes/pedidoRoutes');
const detallePedidoRoutes = require('./routes/detallePedidoRoutes');

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors()); // Permitir peticiones desde otros dominios
app.use(express.json()); // Parsear JSON en las peticiones
app.use(express.urlencoded({ extended: true })); // Parsear formularios

// Middleware para logging de peticiones
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    mensaje: '¡Bienvenido a tu API REST de Computadoras!',
    version: '1.0.0',
    endpoints: {
      clientes: '/api/clientes',
      productos: '/api/productos',
      Pedidos: '/api/pedidos',
      DetallePedidos: '/api/detalle-pedidos'
    },
    documentacion: 'Consulta la guía para ver todos los endpoints disponibles'
  });
});

// Configurar rutas de la API
app.use('/api/clientes', clienteRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/pedidos', pedidoRoutes);
app.use('/api/detalle-pedidos', detallePedidoRoutes);

// Middleware para manejar rutas no encontradas
app.use((req, res) => {
  res.status(404).json({
    mensaje: 'Ruta no encontrada',
    ruta_solicitada: req.originalUrl,
    metodo: req.method,
    sugerencia: 'Verifica la URL y el método HTTP'
  });
});

// Middleware global para manejo de errores
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error);
  res.status(500).json({
    mensaje: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Algo salió mal'
  });
});

// Función para iniciar el servidor
async function iniciarServidor() {
  try {
    console.log('Conectando a la base de datos...');
    await sequelize.authenticate();
    console.log('Conexión a MySQL exitosa');

    // Sincronizar modelos (opcional, solo en desarrollo)
    // await sequelize.sync({ alter: true });
    // console.log('Modelos sincronizados');

    app.listen(PORT, () => {
      console.log('Servidor iniciado exitosamente');
      console.log(`URL: http://localhost:${PORT}`);
      console.log('Endpoints disponibles:');
      console.log(' - GET /api/clientes');
      console.log(' - POST /api/clientes');
      console.log(' - GET /api/productos');
      console.log(' - POST /api/productos');
      console.log(' - GET /api/pedidos');
      console.log(' - POST /api/pedidos');
      console.log(' - GET /api/detalle-pedidos');
      console.log(' - POST /api/detalle-pedidos');
      console.log('Para detener el servidor: Ctrl + C');
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
}

// Iniciar el servidor
iniciarServidor();

module.exports = app;
