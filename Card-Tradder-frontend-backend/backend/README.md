# Card-Tradder – Backend

Backend en **Node.js + Express + MongoDB** para la plataforma de intercambio y venta de cartas coleccionables.

## Requisitos (modo local)

- Node.js
- MongoDB en ejecución (por defecto: `mongodb://127.0.0.1:27017/cardtrader`)

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Copia el archivo de ejemplo de entorno y edítalo:

```bash
cp .env.example .env
```

Ajusta `MONGO_URI` y `JWT_SECRET` si es necesario.

## Ejecución

```bash
npm start
```

El servidor se ejecutará en `http://localhost:3000` y servirá el frontend desde `../frontend/public`.

## Ejecución con Docker Compose

1. Copia y adapta las variables de entorno:

```bash
cp .env.example .env
```

2. Construye e inicia los servicios (API + MongoDB + Redis):

```bash
docker compose up --build
```

- La API quedará disponible en `http://localhost:3000`.
- MongoDB se expone en el puerto `27017` y Redis en `6379`.
- El contenedor de la API usa la configuración de `.env` y, por defecto, se conecta a los contenedores `mongo` y `redis` definidos en `docker-compose.yml`.

## Roles, autenticación y endpoints clave

- **Registro**: `POST /api/register` con `name`, `email`, `password` y `role` (`cliente`, `vendedor` o `admin`).
- **Login**: `POST /api/login` devuelve JWT y rol.
- **Ruta protegida**: `GET /api/me` requiere header `Authorization: Bearer <token>`.
- **Actualizar perfil**: `PATCH /api/me` permite cambiar `name` y `contactWhatsapp` del usuario autenticado (el WhatsApp se reutiliza como valor por defecto al crear publicaciones nuevas).
- **Restricción por rol**:
  - `GET /api/listings` devuelve únicamente publicaciones aprobadas por defecto (opcional `?status=` para otros filtros) y devuelve el vendedor (solo `status=aprobada` se usa en catálogos de cartas).
  - `POST/PUT/DELETE /api/listings` solo para rol `vendedor` y únicamente sobre sus propias publicaciones. Aceptan `imageData` (base64) y `contactWhatsapp` opcionales; el WhatsApp se protege y solo se expone mediante `GET /api/listings/:id/contact` al vendedor, admin o comprador con reserva activa.
  - `GET /api/admin/publications` y `PATCH /api/admin/publications/:id/status` requieren rol `admin` para aprobar o rechazar publicaciones.

### Flujo mínimo de publicaciones

1. Crear usuarios con `role: vendedor` y `role: admin` (ver sección de semillas).
2. El vendedor crea un listing con `name`, `price`, `condition`, `description` y, opcionalmente, `cardId` (TCG), `imageData` (base64) y `contactWhatsapp` → queda en `status: pendiente`.
3. El admin consulta `GET /api/admin/publications?status=pendiente` y aprueba/rechaza con `PATCH ... { "status": "aprobada" }`.
4. Solo las publicaciones **aprobadas** aparecen en `GET /api/cards/search` (catálogo cacheado) y en `GET /api/cards/:id`.

### Validaciones de negocio clave

- Cada comprador puede generar **máximo 7 órdenes o reservas por semana** (excluye canceladas). Si supera el límite, `/api/orders` responde con 400.
- Las publicaciones rechazadas deben incluir `rejectionReason`; el admin debe enviarla al usar `PATCH /api/admin/publications/:id/status` con `status="rechazada"`.
- Las órdenes en estado `reservada` se auto-cancelan tras 24 horas sin confirmación de pago; el historial y las notificaciones de la orden reflejan la caducidad y el comprador recibe aviso. Las reservas nuevas quedan en `pendiente` hasta que el vendedor/admin las apruebe.
- Una publicación con reserva pendiente, aprobada o pagada bloquea nuevas compras o reservas y expone `reservedUntil` una vez aprobada para mostrar el contador de 24 horas en el frontend; si la reserva se cancela manual o automáticamente, la disponibilidad se restablece. La publicación permanece visible en el catálogo marcada como reservada en lugar de ocultarse.
- Cuando un vendedor marca una orden como `pagada` o `cancelada`, el sistema agrega una notificación para el comprador (campo `notifications`).
- Solo el rol `cliente` puede crear reservas; si otro rol lo intenta, `POST /api/orders` responde con 403.
- Solo el comprador con una reserva activa (o el vendedor/admin) puede recuperar el WhatsApp del vendedor mediante `GET /api/listings/:id/contact`; el número no se expone en catálogos ni en órdenes ajenas.

### Órdenes, reservas y pagos externos

- **Crear orden o reserva**: `POST /api/orders` con `listingId` y `type` (`compra` o `reserva`).
  - `type=compra` → estado inicial `pendiente`.
  - `type=reserva` → estado inicial `pendiente` (requiere aprobación de vendedor/admin para pasar a `reservada`).
  - Al crear una reserva, se agrega una notificación dirigida al vendedor en el campo `notifications` de la orden.
- **Consultar mis órdenes**: `GET /api/orders`
  - Admin: todas las órdenes.
  - Vendedor: órdenes de sus publicaciones.
  - Cliente: sus compras/reservas.
- **Detalle con historial**: `GET /api/orders/:id` devuelve la historia de cambios.
- **Actualizar estado**: `PATCH /api/orders/:id/status { "status": "pagada" | "cancelada" | "reservada" | "pendiente" }`
  - Vendedor/Admin pueden marcar `pagada`, `reservada`, etc.
  - El comprador puede cancelar su propia orden (`status=cancelada`).
  - Cada cambio queda registrado en `history` con quién lo realizó y fecha/hora.

### Cache Redis

El endpoint `GET /api/cards/search?q=<texto>` se cachea por 60 segundos.

- Primera llamada → header `X-Cache: MISS`.
- Llamada repetida con la misma query → `X-Cache: HIT` y respuesta inmediata desde Redis.

### Pruebas manuales (Postman/cURL)

Consulta `docs/POSTMAN_TESTS.md` para un guion rápido de pruebas de autenticación, creación/aprobación de publicaciones y verificación del caché con encabezados `X-Cache`. Incluye los cuerpos de ejemplo y los tokens requeridos para cada rol.

Guía exprés en Postman:
- Crea un **entorno** con `baseUrl` (`http://localhost:3000`) y variables de token (`adminToken`, `sellerToken`, `buyerToken`).
- En cada login agrega en la pestaña **Tests** el script que guarda el `token` en la variable correspondiente (`pm.environment.set("adminToken", data.token)`), así las demás peticiones usan `Authorization: Bearer {{adminToken}}`.
  - Sigue el orden: registro/login → crear listing con datos e imagen opcional → aprobarlo → consumir catálogo → crear órdenes/reservas y actualizar estados.

### Semillas / usuarios de ejemplo

- Crear un administrador rápido: `node scripts/createAdmin.js admin@example.com admin123` (requiere MongoDB iniciado y variables de entorno cargadas). Con Docker: `docker compose exec api node scripts/createAdmin.js admin@example.com admin123`.
- La semilla `scripts/create_fake_listings.js` puede poblar cartas y vendedores falsos si necesitas datos de prueba adicionales.
