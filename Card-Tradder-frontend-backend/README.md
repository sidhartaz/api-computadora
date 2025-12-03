# Card-Tradder – Estructura separada Frontend / Backend

Este proyecto se ha reorganizado para separar claramente:

- `backend/` → API en Node.js + Express + MongoDB
- `frontend/` → Sitio web (HTML, CSS, JS estático) servido por el backend

## Cómo ejecutar en modo local

1. Entra al backend:

```bash
cd backend
npm install
cp .env.example .env   # y ajusta MONGO_URI/JWT_SECRET si es necesario
npm start
```

2. Abre en el navegador:

```text
http://localhost:3000
```

El backend sirve directamente los archivos estáticos desde `../frontend/public`.

### Roles y flujo mínimo

- `POST /api/register` acepta roles `cliente`, `vendedor` o `admin`.
- Los endpoints de publicaciones (`/api/listings`) requieren rol `vendedor` y el admin aprueba/rechaza desde `/api/admin/publications`.
- `GET /api/cards/search` está cacheado en Redis (observa `X-Cache: MISS/HIT`).

## Cómo ejecutar con Docker Compose

1. Desde `backend/`, copia el archivo de entorno y ajusta valores según tu entorno:

```bash
cd backend
cp .env.example .env
```

2. Levanta la API junto con MongoDB y Redis:

```bash
docker compose up --build
```

- La API quedará disponible en `http://localhost:3000`.
- MongoDB y Redis se exponen en los puertos `27017` y `6379` respectivamente.

La carpeta `docs/` (dentro de `backend/`) contiene la documentación de requisitos y diseño del proyecto.
