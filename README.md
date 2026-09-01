# Partner Activation Program — Backend

Backend NestJS del Partner Activation Program (Kaspersky). Contexto de negocio y decisiones
de arquitectura en `../CLAUDE.md`.

## Setup

```bash
npm install
cp .env.example .env   # completar con los datos reales del proyecto Supabase/AWS (dev)
npm run start:dev      # http://localhost:3001
```

## Variables de entorno (`.env`)

| Variable | Requerida | Descripción |
|---|---|---|
| `PORT` | no (default 3000) | Puerto del servidor. Local usa 3001 (ver `.env`). |
| `NODE_ENV` | no | `development` \| `production` \| `staging` \| `test`. |
| `FRONTEND_URL` | no | URL pública del frontend — `redirectTo` de invitaciones y links en los emails. Sin esto, Supabase usa el Site URL global del proyecto. |
| `SUPABASE_URL` | sí | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | sí | Secret key (`sb_secret_...`) — **nunca** la publishable/anon key, este cliente bypassa RLS. |
| `AWS_REGION` | sí | `eu-central-1` (Frankfurt) — ver CLAUDE.md, decisión de hosting UE. |
| `AWS_S3_BUCKET` | sí | Bucket de evidencias (`infra/terraform/s3.tf`). |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | no | Solo para local/Railway. En App Runner el SDK toma credenciales del instance role automáticamente (`infra/terraform/iam.tf`) — no hace falta setearlas ahí. |
| `AWS_SES_FROM_EMAIL` | sí | Remitente verificado en SES para notificaciones (`infra/terraform/ses.tf`). SES sigue en modo sandbox: remitente y cada destinatario deben verificarse a mano en la consola de AWS hasta pedir acceso de producción. |

## Setup de Supabase (proyecto nuevo)

1. Crear el proyecto Supabase (dev), región UE (ver CLAUDE.md).
2. Ejecutar, en este orden, en el SQL editor del proyecto:
   1. `supabase/schema.sql` — `profiles` + trigger de creación desde `auth.users`.
   2. `supabase/schema_missions.sql` — milestones/tareas/evidencias, seed de contenido del brief.
   3. `supabase/schema_rewards.sql` — catálogo de rewards + redenciones.
   4. `supabase/schema_reminders.sql` — columna `reminded_at` para el throttle de recordatorios.
3. Copiar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API Keys →
   "Secret keys") al `.env`.
4. Habilitar Google OAuth en Authentication → Providers si se va a probar ese login (requiere
   un Client ID/Secret de Google Cloud aparte).
5. En Authentication → URL Configuration, agregar la URL del frontend a "Redirect URLs" —
   sin esto, los links de invitación/OAuth caen al Site URL por defecto.

Para promover un usuario a `admin`: `update public.profiles set role = 'admin' where email =
'...'` — no hay UI para esto todavía, es manual por SQL.

## Estructura

- `src/supabase/` — cliente Supabase con service role key (solo backend).
- `src/auth/` — verificación JWT vía JWKS (`jwks-rsa`, soporta la rotación de claves de
  Supabase a ECC P-256) + guards de rol (`JwtAuthGuard`, `RolesGuard` + `@Roles()`). El rol de
  negocio vive en `profiles`, no en el JWT — se consulta en cada request.
- `src/partners/` — invitación de partners (`POST /partners`, admin), perfil propio y por id,
  listado.
- `src/milestones/` — motor de hitos: vista del partner (desbloqueo secuencial calculado en
  vivo desde `task_evidence`), envío de evidencia (texto o archivo vía S3 presigned POST),
  cola/historial de revisión admin.
- `src/rewards/` — catálogo de rewards (elegibilidad por milestone completado, no por
  puntos/tiers — sigue sin definir con Kaspersky), solicitud y revisión de redenciones.
- `src/email/` — envío transaccional vía AWS SES, fire-and-forget (un fallo de envío nunca
  bloquea ni rompe la respuesta de la API).
- `src/reminders/` — cron diario (`@nestjs/schedule`) que recuerda a partners con una tarea
  pendiente y sin actividad en 7 días, con throttle de 7 días.
- `src/stats/` — KPIs del admin (`GET /admin/stats`): tasa de activación, tasa de finalización
  de milestones, tiempo a la primera venta — calculados en el momento, sin tabla de agregación.
- `src/aws/` — cliente S3 (presigned POST de subida, URLs firmadas de descarga).
- `infra/terraform/` — infraestructura AWS (App Runner, ECR, IAM, S3, SES, OIDC de GitHub
  Actions). Ver el README de ese directorio antes de tocar nada ahí — el orden de aplicación
  importa.

## Deploy

CI/CD vía GitHub Actions (`.github/workflows/deploy.yml`): en cada push a `main`, corre
lint/test/build y, si pasa, hace build+push de la imagen a ECR — App Runner la toma sola
(`auto_deployments_enabled = true`). Requiere el secret `AWS_DEPLOY_ROLE_ARN` configurado en
el repo de GitHub (ver `infra/terraform/github-actions.tf`, output `github_actions_role_arn`).

**Importante sobre GitHub OIDC**: el claim `sub` que manda GitHub incluye los IDs numéricos
inmutables del owner/repo (`repo:<owner>@<ownerId>/<repo>@<repoId>:ref:...`), no el simple
`owner/repo` que documentan la mayoría de los tutoriales — si se recrea este setup en otro
repo, hay que sacar esos IDs de la API de GitHub (`GET /repos/<owner>/<repo>` → `id`, y del
owner) en vez de asumir el formato simple.

## Testing manual sin recibir emails

Para probar login/invitaciones sin gastar el rate limit de Supabase ni esperar un email real:

```js
const { data } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
const { data: session } = await supabaseAnon.auth.verifyOtp({
  token_hash: data.properties.hashed_token,
  type: "magiclink",
});
// session.session.access_token sirve como Bearer token para probar cualquier endpoint
```
