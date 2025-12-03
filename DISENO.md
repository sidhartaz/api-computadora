# DISEÑO FUNCIONAL & TÉCNICO  
Plataforma de Intercambio y Venta de Cartas Coleccionables

Autores: Carlos Sepúlveda, Bryam Beltrán  
Basado en: **REQUERIMIENTOS DEL PROYECTO v1.2**

---

## 1. Diagrama de casos de uso / mapa de funcionalidades

### 1.1 Actores

- **Administrador**
  - Supervisa la plataforma.
  - Valida autenticidad de cartas y publicaciones.
  - Suspende usuarios y publicaciones.
  - Audita cambios de estado de órdenes.

- **Vendedor**
  - Tiene suscripción semanal.
  - Publica cartas y gestiona sus publicaciones.
  - Actualiza estado de órdenes (pagada / cancelada / reservada).
  - Consulta historial de ventas.

- **Cliente**
  - Rol base tras registrarse.
  - Navega el catálogo, compra y reserva cartas.
  - Deja reseñas y calificaciones después de una compra.

- **Usuario Invitado**
  - Navega catálogo básico y ve detalles de cartas.
  - Debe registrarse para comprar, reservar o reseñar.

### 1.2 Casos de uso principales

**Usuario Invitado**
- UC-01: Registrarse.
- UC-02: Iniciar sesión.
- UC-03: Ver catálogo de cartas.

**Cliente**
- UC-04: Completar/actualizar perfil (datos, contacto, preferencia de pago).
- UC-05: Buscar cartas por juego, rareza, valor estimado, etc.
- UC-06: Comprar o reservar carta (crea orden sin pago en línea).
- UC-07: Ver historial de órdenes (compras y reservas).
- UC-08: Dejar reseña y calificación sobre una compra completada.

**Vendedor**
- UC-09: Activar/renovar suscripción semanal.
- UC-10: Publicar carta con nombre, juego, condición, imagen y precio.
- UC-11: Editar o eliminar publicaciones propias.
- UC-12: Actualizar estado de órdenes (pagada, cancelada, reservada).
- UC-13: Ver historial de ventas.

**Administrador**
- UC-14: Aprobar o rechazar publicaciones de cartas.
- UC-15: Validar autenticidad de cartas (estado de verificación).
- UC-16: Suspender cuentas y publicaciones.
- UC-17: Auditar cambios de estado de órdenes.
- UC-18: Gestionar trueques y subastas (prioridad baja, fase posterior).

### 1.3 Diagrama de casos de uso (Mermaid)
## Diagrama de Casos de Uso – Cliente
![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-031134.png>)
## Diagrama de Casos de Uso - Vendedor
![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-032144.png>)
## Diagrama de Casos de Uso - Admnistrador
![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-032518.png>)
### 1.4 Diagrama de flujo de procesos
![alt text](<WhatsApp Image 2025-11-19 at 20.02.26.jpeg>)
### 1.5 Diagramas de secuencia (funcional)
![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-115335.png>)
## 2. Descripción de módulos y flujo por rol

### 2.1 Módulos del sistema

#### Módulo de Autenticación y Roles

- Registro e inicio de sesión (**RF-01**).
- Gestión de roles: `cliente`, `vendedor`, `admin`.
- Uso de tokens **JWT** para proteger rutas.

#### Módulo de Perfiles

- Gestión de datos personales: nombre, RUT, contacto.
- Registro de preferencia de método de pago (informativo).
- Historial de compras/ventas asociado al usuario (**RF-05**).

#### Módulo de Cartas y Publicaciones

- Registro de cartas (tipo de juego, calidad, valor estimado, autenticación).
- Publicación de cartas por vendedores con precio (**RF-02**).
- Flujo de aprobación de publicaciones por administrador (**RF-03**).
- Suspensión y rechazo de publicaciones (**RF-06** + reglas de negocio).

#### Módulo de Órdenes, Compras y Reservas

- Creación de órdenes de compra/reserva (**RF-04**).
- Estados de la orden: `pendiente_pago`, `reservada`, `pagada`, `cancelada` (**RF-05**).
- Gestión de expiración de reservas (1 día) y actualización por vendedor (**RF-09**).
- Registro de todos los cambios de estado (auditoría básica).

#### Módulo de Suscripciones de Vendedor

- Registro de suscripción semanal.
- Estado de suscripción: `activa`, `vencida`.
- Solo vendedores con suscripción **activa** pueden publicar y ser visibles al público.

#### Módulo de Reputación y Reseñas

- Registro de reseñas y calificaciones de clientes a vendedores (**RF-08**).
- Cálculo de reputación promedio por vendedor.

#### Módulo de Notificaciones

- Notifica al cliente cuando el vendedor marca una orden como `pagada` o `cancelada` (**RF-10**).

#### Módulo de Auditoría y Moderación

- Registro de cambios de estado en órdenes, usuarios y publicaciones.
- Herramientas de administrador para ver históricos y realizar auditoría básica.

---

### 2.2 Flujo por rol (resumen)

#### Cliente

1. Se registra y se autentica.
2. Completa su perfil.
3. Navega el catálogo y filtra por juego, rareza, valor, etc.
4. Crea una orden de compra o reserva (sin pago en línea).
5. Coordina pago y entrega por canales externos (transferencia, efectivo, etc.).
6. Visualiza el estado de sus órdenes y deja reseñas al finalizar una compra.

#### Vendedor

1. Solicita rol de vendedor y activa una suscripción semanal.
2. Registra cartas y crea publicaciones.
3. Espera la aprobación del administrador para que sus publicaciones sean visibles.
4. Gestiona sus publicaciones (editar, eliminar, suspender).
5. Actualiza estados de órdenes (marcar como `pagada`, `cancelada`, `reservada`).
6. Consulta su historial de ventas.

#### Administrador

1. Revisa y aprueba/rechaza publicaciones de cartas.
2. Valida la autenticidad y calidad de cartas.
3. Suspende usuarios y publicaciones que infringen las normas.
4. Audita órdenes y cambios de estado registrados en el sistema.
5. Revisa y gestiona trueques y subastas (cuando se implementen en fases posteriores).
## 3. Diagrama de arquitectura (API, MongoDB, Redis, Docker)

### 3.1 Descripción

- **Frontend**: SPA (React/Vue) que consume la API por HTTP/HTTPS.
- **Backend**: API REST desarrollada con **Node.js + Express**.
- **Base de datos**: **MongoDB** para persistencia de usuarios, cartas, órdenes, suscripciones, reseñas, etc.
- **Caché**: **Redis** para mejorar rendimiento en:
  - Catálogo de publicaciones.
  - Búsquedas frecuentes.
  - Historiales de órdenes.

- **Infraestructura**:
  - **Desarrollo**: `docker-compose` con servicios:
    - `api` (Node.js/Express)
    - `mongodb`
    - `redis`
  - **Producción**:
    - Servidor cloud (Azure/AWS).
    - MongoDB y Redis gestionados o desplegados en contenedores.

- **Pagos**:
  - La plataforma **no procesa pagos en línea**; solo registra órdenes y estados.
  - El pago real se gestiona externamente (transferencia, efectivo, otros medios), en coherencia con los requerimientos del cliente.

### 3.2 Diagrama de arquitectura (Mermaid)

![alt text](<WhatsApp Image 2025-11-19 at 20.02.25.jpeg>)

## 4. Modelo de datos (MongoDB + Mongoose)
### Diagrama Entidad–Relación (ER)
![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-120110.png>)
### 4.1 Colecciones principales
| Colección       | Descripción                                        |
| --------------- | -------------------------------------------------- |
| `users`         | Usuarios del sistema (clientes, vendedores, admin) |
| `cards`         | Cartas registradas (atributos base)                |
| `listings`      | Publicaciones de cartas (venta/intercambio)        |
| `orders`        | Órdenes de compra / transacciones                  |
| `subscriptions` | Suscripciones de vendedor                          |
### 4.1.1 Colección `users`

Campos principales:

| Campo        | Tipo    | Restricciones / Descripción                                       |
|--------------|---------|-------------------------------------------------------------------|
| `name`       | String  | Requerido. Nombre del usuario.                                   |
| `email`      | String  | Requerido, único. Correo de acceso al sistema.                   |
| `passwordHash` | String| Requerido. Hash de la contraseña.                                |
| `role`       | String  | Requerido. Enum: `customer`, `seller`, `admin`.                  |
| `status`     | String  | Enum: `active`, `banned`. Por defecto: `active`.                 |
| `createdAt`  | Date    | Fecha de creación (generada automáticamente).                    |
| `updatedAt`  | Date    | Fecha de última actualización (generada automáticamente).        |

---

### 4.1.2 Colección `cards`

Campos principales:

| Campo        | Tipo     | Restricciones / Descripción                                      |
|--------------|----------|------------------------------------------------------------------|
| `name`       | String   | Requerido. Nombre de la carta.                                  |
| `game`       | String   | Enum: `pokemon`, `myths_legends`, `yugioh`, etc.                |
| `rarity`     | String   | Rareza de la carta.                                             |
| `edition`    | String   | Edición o set al que pertenece.                                 |
| `condition`  | String   | Condición: ej. `mint`, `near-mint`, `played`.                   |
| `imageUrl`   | String   | URL de la imagen de referencia.                                 |
| `createdBy`  | ObjectId | Requerido. Referencia a `users` (usuario que registró la carta).|
| `createdAt`  | Date     | Fecha de creación del registro.                                 |

---

### 4.1.3 Colección `listings`

Campos principales:

| Campo        | Tipo     | Restricciones / Descripción                                      |
|--------------|----------|------------------------------------------------------------------|
| `card`       | ObjectId | Requerido. Referencia a `cards`.                                 |
| `seller`     | ObjectId | Requerido. Referencia a `users` (vendedor).                      |
| `type`       | String   | Requerido. Enum: `sell`, `trade`.                                |
| `price`      | Number   | Requerido si `type = sell`. Precio de la publicación.           |
| `status`     | String   | Enum: `active`, `paused`, `sold`, `removed`.                     |
| `views`      | Number   | Contador de vistas. Por defecto: `0`.                            |
| `createdAt`  | Date     | Fecha de creación.                                               |
| `updatedAt`  | Date     | Fecha de última actualización.                                   |

---

### 4.1.4 Colección `orders`

Campos principales:

| Campo        | Tipo     | Restricciones / Descripción                                      |
|--------------|----------|------------------------------------------------------------------|
| `buyer`      | ObjectId | Requerido. Referencia a `users` (comprador).                     |
| `seller`     | ObjectId | Requerido. Referencia a `users` (vendedor).                      |
| `listing`    | ObjectId | Requerido. Referencia a `listings`.                              |
| `totalPrice` | Number   | Requerido. Total acordado de la orden.                           |
| `status`     | String   | Enum: `pending`, `paid`, `shipped`, `completed`, `cancelled`.    |
| `createdAt`  | Date     | Fecha de creación.                                               |
| `updatedAt`  | Date     | Fecha de última actualización.                                   |

---

### 4.1.5 Colección `subscriptions`

Campos principales:

| Campo        | Tipo     | Restricciones / Descripción                                      |
|--------------|----------|------------------------------------------------------------------|
| `user`       | ObjectId | Requerido. Referencia a `users` (vendedor suscrito).             |
| `plan`       | String   | Plan contratado, ej.: `weekly`, `monthly`.                       |
| `status`     | String   | Enum: `active`, `expired`.                                       |
| `startDate`  | Date     | Fecha de inicio de la suscripción.                               |
| `endDate`    | Date     | Fecha de término de la suscripción.                              |

---
## 5. Estrategia de caché en Redis

Para mejorar el rendimiento y reducir la carga sobre la base de datos, se utiliza Redis como capa de caché para consultas frecuentes y datos muy consultados, pero poco cambiantes.

### 5.1 Qué se cachea

**Listas de cartas populares**

- **Endpoint:** `GET /cards/popular`  
- **Clave Redis:** `cards:popular`  
- **TTL:** 60 segundos  
- **Descripción:** Se cachea el listado de cartas más vistas o con mayor interacción para responder más rápido a la pantalla principal o secciones destacadas.

---

**Detalle de publicación de carta**

- **Endpoint:** `GET /listings/:id`  
- **Clave Redis:** `listing:{id}`  
- **TTL:** 120 segundos  
- **Descripción:** Se cachea el detalle de una publicación específica para acelerar la carga de la ficha de la carta.

---

**Resultados de búsqueda frecuentes**

- **Endpoint (ejemplo):** `GET /cards?game=pokemon&rarity=rare`  
- **Clave Redis:** `search:cards:{hashQuery}`  
- **TTL:** 60 segundos  
- **Descripción:** Se genera un hash de la query (`{hashQuery}`) y se cachean los resultados de búsqueda más frecuentes para mejorar el rendimiento del buscador.

---

### 5.2 Estrategia de invalidación

Para mantener coherencia entre la caché y los datos reales, se definen reglas de invalidación cuando hay cambios relevantes en las publicaciones u órdenes.

**Al crear/editar/eliminar una publicación**  
(Endpoints: `POST /listings`, `PUT /listings/:id`, `DELETE /listings/:id`):

- Eliminar claves relacionadas en Redis:
  - `cards:popular`
  - `search:cards:*` (o al menos las más utilizadas/recientes).
  - `listing:{id}` de la publicación afectada.

Esto obliga a que, en la siguiente consulta, la API recalcule la información y la vuelva a cachear con datos actualizados.

---

**Al actualizar el estado de una orden a completada**  
(Cuando `status = completed` implica que la carta se considera vendida):

1. Actualizar el estado del `listing` asociado a `sold`.
2. Eliminar `listing:{id}` en Redis para que, en la siguiente consulta, se obtenga el detalle actualizado (ya no disponible o marcado como vendido).

De esta forma, la caché se mantiene consistente con las reglas de negocio y el estado real de las publicaciones.
## 6. Endpoints principales (rutas, método, input/output, permisos)
### 6.1 Autenticación
| Método | Ruta             | Descripción             | Body (request)              | Respuesta (200)                            | Roles   |
| ------ | ---------------- | ----------------------- | --------------------------- | ------------------------------------------ | ------- |
| POST   | `/auth/register` | Registrar nuevo usuario | `{ name, email, password }` | `{ user: {id, name, email, role}, token }` | Público |
| POST   | `/auth/login`    | Iniciar sesión          | `{ email, password }`       | `{ user: {id, name, email, role}, token }` | Público |
### 6.2 Usuarios
| Método | Ruta         | Descripción               | Permisos                   |
| ------ | ------------ | ------------------------- | -------------------------- |
| GET    | `/users/:id` | Obtener perfil de usuario | Auth (propietario o admin) |
### 6.3 Cartas (recurso principal: cards + listings)
| Método | Ruta         | Descripción                      | Permisos |
| ------ | ------------ | -------------------------------- | -------- |
| GET    | `/cards`     | Listar cartas (con filtros)      | Público  |
| GET    | `/cards/:id` | Ver detalle de carta (cacheable) | Público  |
### Listings (publicaciones de cartas)
| Método | Ruta            | Descripción                            | Body principal            | Permisos                       |
| ------ | --------------- | -------------------------------------- | ------------------------- | ------------------------------ |
| POST   | `/listings`     | Crear publicación de carta             | `{ cardId, type, price }` | Vendedor                       |
| GET    | `/listings`     | Listar publicaciones activas           | (query: filtros)          | Público                        |
| GET    | `/listings/:id` | Ver detalle de publicación (cacheable) | -                         | Público                        |
| PUT    | `/listings/:id` | Editar publicación                     | `{ price?, status? }`     | Vendedor (propietario)         |
| DELETE | `/listings/:id` | Eliminar publicación                   | -                         | Vendedor (propietario) o Admin |
### 6.4 Orders
| Método | Ruta          | Descripción                            | Body (request)  | Permisos                        |
| ------ | ------------- | -------------------------------------- | --------------- | ------------------------------- |
| POST   | `/orders`     | Crear orden a partir de listing        | `{ listingId }` | Cliente/Vendedor como comprador |
| GET    | `/orders`     | Listar órdenes del usuario autenticado | -               | Cliente/Vendedor                |
| GET    | `/orders/:id` | Ver detalle de una orden específica    | -               | Buyer/Seller/Admin              |

## 7. Diseño de UI: navegación y wireframes
### 7.1 Diagrama de navegación de UI

El diagrama de navegación de UI muestra cómo se conectan las principales pantallas de la plataforma:

Home / Catálogo.

Detalle de carta.

Login / Registro.

Perfil de cliente.

Dashboard de vendedor.

Historial de órdenes.
![alt text](<WhatsApp Image 2025-11-19 at 20.14.37.jpeg>)
### 7.2 Mockups / Wireframes

Se incluyen wireframes simples en la carpeta `/docs/wireframes` para las principales pantallas del sistema:

- `home.png`: vista inicial con listado de cartas destacadas.

- `catalogo.png`: catálogo con filtros por juego, rareza y rango de precio.
- `login.png`: formulario de inicio de sesión.
- `register.png`: formulario de registro de usuario.
- `perfil-cliente.png`: perfil de cliente con datos personales e historial de órdenes.
- `dashboard-vendedor.png`: panel de vendedor con sus publicaciones y ventas.
- `detalle-listing.png`: ficha detallada de una publicación de carta.
- `historial-ordenes.png`: historial de compras/reservas del usuario.

Estos mockups sirven como referencia visual del flujo descrito en las secciones anteriores.

## 8. Diseño orientado a objetos y diagramas de secuencia técnicos
### 8.1 Diagrama de clases

El diagrama de clases describe la estructura orientada a objetos de la aplicación (modelo de dominio), incluyendo las clases principales y sus relaciones (por ejemplo: User, Card, Listing, Order, Subscription, etc.).

El diagrama se almacena en:
![alt text](<WhatsApp Image 2025-11-19 at 20.02.26(1).jpeg>)

### 8.2 Diagramas de secuencia (técnicos)

Los diagramas de secuencia técnicos detallan la interacción entre:

- Frontend (SPA),

- API REST (controladores),

- Capa de servicios,

- MongoDB,

- Redis (caché),

- para casos de uso clave, por ejemplo:

- onsulta de catálogo utilizando caché Redis.

- Creación de orden con actualización de estado de publicación.

![alt text](<Mermaid Chart - Create complex, visual diagrams with text.-2025-11-20-122314.png>)

## Anexos
### 4.1.1 Colección `users`
```js
// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  rut: {
    type: String,
    required: true,
  },
  contact: {
    type: String, // email alternativo, teléfono, @usuario, etc.
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['customer', 'seller', 'admin'], // Cliente, Vendedor, Administrador
    default: 'customer',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'banned'],
    default: 'active',
  },
  preferredPaymentMethod: {
    type: String, // Informativo: transferencia, efectivo, etc.
  },
}, {
  timestamps: true, // createdAt, updatedAt
});

module.exports = mongoose.model('User', userSchema);

### 4.1.2 Colección `cards`
// models/Card.js
const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  game: {
    type: String,
    enum: ['pokemon', 'yugioh', 'myths_legends', 'other'],
    required: true,
  },
  estimatedValue: {
    type: Number, // Valor estimado de referencia (opcional)
  },
  rarity: {
    type: String, // rare, super rare, etc.
  },
  edition: {
    type: String, // expansión o set
  },
  condition: {
    type: String, // mint, near-mint, played...
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Admin que verificó la carta
  },
  verifiedAt: {
    type: Date,
  },
  imageUrl: {
    type: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // usuario que registró la carta
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Card', cardSchema);//.md

### 4.1.3 Colección `listings`
// models/Listing.js
const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema({
  card: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Card',
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['sell', 'trade'], // venta o intercambio (trueque)
    default: 'sell',
    required: true,
  },
  price: {
    type: Number, // requerido si type = 'sell'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending', // RF-03: admin debe aprobar antes de ser visible
  },
  rejectionReason: {
    type: String, // motivo obligatorio si se rechaza
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'sold', 'cancelled', 'removed'],
    default: 'active',
  },
  views: {
    type: Number,
    default: 0,
  },
  isVisible: {
    type: Boolean,
    default: false, // solo true si aprobación ok y vendedor tiene suscripción activa
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Listing', listingSchema);

### 4.1.4 Colección `orders`
// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  listing: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'reserved', 'paid', 'cancelled', 'completed'],
    default: 'pending', // "pendiente de pago" al crear la orden
  },
  isReservation: {
    type: Boolean,
    default: false, // true cuando sea reserva
  },
  reservationExpiresAt: {
    type: Date, // para aplicar regla de 1 día de expiración de reservas
  },
  paymentMethod: {
    type: String, // informativo: transferencia, efectivo, etc.
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Order', orderSchema);

### 4.1.5 Colección `subscriptions`
// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // vendedor
    required: true,
  },
  plan: {
    type: String,
    enum: ['weekly'],
    default: 'weekly',
  },
  status: {
    type: String,
    enum: ['active', 'expired'],
    default: 'active',
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Subscription', subscriptionSchema);

