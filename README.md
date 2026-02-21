# CerebroMat
Monorepo local (offline-first) para app web + móvil de matemáticas para niños (infantil a 12 años), con progreso adaptativo, analíticas y panel escolar.

## Stack
- Monorepo: `pnpm workspaces`
- Backend: `NestJS + Prisma ORM + PostgreSQL local (Docker)`
- Web: `Next.js App Router + TypeScript + Tailwind + shadcn/ui`
- Mobile: `React Native Expo + TypeScript`
- Shared: `packages/shared` (`zod` schemas + tipos + helpers)

## Estructura
```text
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   │   ├── migrations
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src
│   │       ├── admin
│   │       ├── analytics
│   │       ├── attempts
│   │       ├── auth
│   │       ├── classes
│   │       ├── exercise
│   │       ├── sessions
│   │       └── students
│   ├── mobile
│   │   ├── app
│   │   │   ├── (tabs)
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── profile.tsx
│   │   │   │   └── progress.tsx
│   │   │   ├── _layout.tsx
│   │   │   └── login.tsx
│   │   ├── components
│   │   └── lib
│   └── web
│       ├── app
│       │   ├── classes
│       │   ├── dashboard
│       │   ├── login
│       │   └── students
│       ├── components
│       │   ├── charts
│       │   └── ui
│       └── lib
├── packages
│   └── shared
│       └── src
│           ├── constants
│           ├── schemas
│           └── utils
├── docker-compose.yml
├── package.json
└── pnpm-workspace.yaml
```

## Requisitos
- Node.js 20+
- `pnpm` (recomendado por `corepack`)
- Docker Desktop (para PostgreSQL local)

## Variables de entorno
- `apps/api/.env.example`
- `apps/web/.env.example`
- `apps/mobile/.env.example`

Por defecto ya hay valores locales listos en:
- `apps/api/.env`
- `apps/web/.env.local`
- `apps/mobile/.env`

## Arranque rápido (3 comandos)
1. Instalar dependencias:
```bash
pnpm install
```

2. Levantar DB + migrar + seed:
```bash
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

3. Levantar todo:
```bash
pnpm dev
```

## URLs y puertos
- Web: `http://localhost:3000`
- API: `http://localhost:4001/api`
- Swagger: `http://localhost:4001/swagger`
- PostgreSQL: `localhost:5432`
- Expo Dev Server: `http://localhost:8081` (normalmente)

## Credenciales demo
Todos con password: `Demo12345!`
- Admin: `admin@demo.local`
- Teacher: `teacher@demo.local`
- Student: `student@demo.local`
- Parent: `parent@demo.local`

Códigos seed:
- Student invite: `STU3A2026`
- Parent invite: `PAR3A2026`

## Scripts raíz
- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm db:migrate`
- `pnpm db:seed`

## API (resumen de endpoints)
- Auth: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`
- Clases: `/classes` (CRUD), `/classes/:id/invites`, `/classes/join`
- Alumnos: `/students`, `/students/:id`
- Sesiones: `/sessions/start`, `/sessions/:id/finish`, `/sessions/:id`
- Intentos: `/attempts/bulk`
- Analíticas: `/analytics/student-series`
- Admin: `/admin/users`, `/admin/users/:id/role`, `/admin/classes`

## Funcionalidad MVP incluida
- Segmentación por edad y modo (`OPERATIONS`, `WORD_PROBLEMS`, `MIXED`)
- Sesiones por defecto de 10 ejercicios
- Generador de operaciones + problemas de texto por edad/nivel
- Dificultad adaptativa por ventana móvil (N=20) y umbrales de precisión/tiempo
- Registro completo de intentos (respuesta, tiempo, nivel, categoría, etc.)
- Teacher crea clases e invitaciones; Student y Parent se vinculan con código
- Dashboard web con clases/alumnos y gráficas por alumno
- App móvil con tabs: `Ejercicios`, `Progreso`, `Perfil`

## Tests implementados
- Unit test generador de ejercicios (`operations` + `word problems`)
- Unit test algoritmo adaptativo de nivel

## Expo en móvil físico
1. Instala **Expo Go** en el móvil.
2. Asegura móvil y ordenador en la misma red.
3. Ejecuta:
```bash
pnpm --filter @cerebromat/mobile start
```
4. Escanea el QR desde Expo Go.

Si usas móvil físico, cambia `EXPO_PUBLIC_API_URL` en `apps/mobile/.env` a la IP LAN de tu máquina (ejemplo: `http://192.168.1.20:4001/api`).
