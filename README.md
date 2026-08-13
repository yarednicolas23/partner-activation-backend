# Partner Activation Program — Backend

Backend NestJS del Partner Activation Program (Kaspersky). Contexto de negocio y decisiones
de arquitectura en `../CLAUDE.md` y `../plan-fase1-infraestructura-autenticacion.md`.

## Setup

```bash
npm install
cp .env.example .env   # completar con los datos del proyecto Supabase (dev)
npm run start:dev
```

## Requisitos previos en Supabase

1. Crear el proyecto Supabase (dev) — región a confirmar (ver CLAUDE.md).
2. Ejecutar `supabase/schema.sql` en el SQL editor del proyecto.
3. Copiar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_JWT_SECRET` (Project
   Settings → API) al `.env`.
4. Habilitar el proveedor de email (magic link) en Authentication → Providers. Para producción
   configurar SMTP propio (ver plan, sección 2.3) — el default de Supabase no sirve para
   volumen/branding real.

## Estructura

- `src/supabase/` — cliente Supabase con service role key (solo backend).
- `src/auth/` — estrategia JWT (valida tokens de Supabase Auth) + guards de rol
  (`JwtAuthGuard`, `RolesGuard` + `@Roles()`).
- `src/partners/` — pre-registro/invitación de partners (`POST /partners`, admin) y perfil
  propio (`GET /partners/me`).

## Notas

- El rol de negocio (`partner`/`admin`) vive en la tabla `profiles`, no en el JWT — `RolesGuard`
  la consulta en cada request. Promover a `admin` es manual (SQL/panel Supabase) por ahora.
- Sin ORM todavía (Prisma queda como pendiente de decisión, ver CLAUDE.md) — se usa el cliente
  `@supabase/supabase-js` directo.



LNhVenA5t2V0SNkQ
