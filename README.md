# Capital 21 Play

Plataforma privada de distribución de contenido multimedia para el **Servicio de Medios Públicos de la Ciudad de México — Capital 21**.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router), React, TypeScript |
| UI | Shadcn/UI, Radix UI, TailwindCSS, Framer Motion |
| Estado | Zustand, React Hook Form |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma |
| Base de datos | PostgreSQL |
| Media | HLS.js, FFmpeg, Multer |
| Auth | JWT + Refresh Tokens, Bcrypt |

---

## Estructura del Proyecto

```
capital21play/
├── frontend/            # Next.js App (puerto 3000)
│   ├── app/
│   │   ├── login/       # Página de login
│   │   └── dashboard/
│   │       ├── admin/   # Dashboard Administrador
│   │       ├── content/ # Dashboard Gestor de Contenido
│   │       └── viewer/  # Dashboard Televisora
│   ├── components/
│   │   ├── ui/          # Biblioteca de componentes
│   │   └── layout/      # Layouts (Sidebar, Topbar)
│   ├── services/        # Capa de API (axios)
│   ├── store/           # Estado global (Zustand)
│   └── types/           # Tipado TypeScript
│
├── backend/             # Express API (puerto 4000)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── config/      # DB, logger, env
│       ├── controllers/
│       ├── services/
│       ├── routes/
│       ├── middleware/
│       ├── workers/     # Procesamiento FFmpeg
│       └── utils/
│
└── README.md
```

---

## Roles del Sistema

| Rol | Permisos |
|---|---|
| `ADMIN` | Gestión total de usuarios, contenido y permisos |
| `CONTENT_MANAGER` | Crear/editar contenido, gestionar permisos de televisoras |
| `BROADCASTER_VIEWER` | Ver y descargar contenido asignado |

---

## Setup Inicial

### Prerrequisitos

- Node.js 20+
- PostgreSQL 15+
- FFmpeg instalado en el sistema
- Redis (opcional, para workers)

### Backend

```bash
cd backend
npm install

# Configura las variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de base de datos

# Inicializa la base de datos
npx prisma migrate dev --name init
npx prisma generate

# Carga datos de prueba
npm run seed

# Inicia el servidor de desarrollo
npm run dev
```

### Frontend

```bash
cd frontend
npm install

# Configura las variables de entorno
cp .env.example .env
# Edita NEXT_PUBLIC_API_URL si es necesario

# Inicia el servidor de desarrollo
npm run dev
```

---

## Variables de Entorno

### Backend (`.env`)

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/capital21play"
JWT_SECRET=min-32-chars-secret-key
JWT_REFRESH_SECRET=min-32-chars-refresh-secret-key
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

### Frontend (`.env`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_STORAGE_URL=http://localhost:4000/storage
```

---

## Credenciales de Prueba (seed)

| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@capital21.mx` | `Admin@Capital21!` |
| Gestor | `contenido@capital21.mx` | `ContentMgr@Capital21!` |
| Televisora | `broadcastertest@capital21.mx` | `Broadcaster@Capital21!` |

---

## API REST — Endpoints Principales

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

GET    /api/v1/users
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

GET    /api/v1/content/series
POST   /api/v1/content/series
POST   /api/v1/content/series/:id/seasons
POST   /api/v1/content/seasons/:id/episodes

GET    /api/v1/content/movies
POST   /api/v1/content/movies

GET    /api/v1/content/programs
POST   /api/v1/content/programs

POST   /api/v1/permissions
DELETE /api/v1/permissions/:id
GET    /api/v1/permissions/my-content

POST   /api/v1/uploads/init
POST   /api/v1/uploads/chunk
GET    /api/v1/uploads/:id/status
```

---

## Pipeline de Procesamiento de Video

1. **Subida chunked** — archivos divididos en chunks de 5MB
2. **Ensamblado** — chunks se unen en archivo completo
3. **Extracción de metadata** — FFprobe extrae duración, resolución, codec
4. **Transcodificación HLS** — FFmpeg genera ladder multi-bitrate (1080p/720p/480p)
5. **Generación de thumbnail** — captura a 10% de la duración
6. **Actualización de estado** — Prisma actualiza el estado del upload

---

## Características

- Autenticación JWT con refresh tokens y rotación automática
- Control de acceso basado en roles (RBAC)
- Permisos granulares por episodio/temporada/serie/película/programa
- Subida masiva de video con progreso en tiempo real
- Streaming HLS multi-calidad (1080p, 720p, 480p)
- Reproductor de video integrado con selección de calidad
- Modo oscuro/claro persistente
- UI completamente responsive

---

© 2026 Gobierno de la Ciudad de México — Capital 21 · Uso exclusivo institucional
