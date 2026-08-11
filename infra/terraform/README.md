# Infraestructura AWS — backend (App Runner)

Provisiona el backend NestJS en AWS App Runner, región `eu-central-1` (Frankfurt), según
`plan-fase1-infraestructura-autenticacion.md` §1.3 (recomendación App Runner para MVP).

## Prerrequisitos

- AWS CLI configurado localmente (`aws configure` o SSO) con un usuario/rol IAM que tenga
  permisos para crear: ECR, App Runner, IAM roles, Secrets Manager. Para el bootstrap inicial,
  `AdministratorAccess` es aceptable — recortar a permisos mínimos después.
- Docker corriendo localmente (para build + push de la imagen).
- Terraform >= 1.7.

## Estado de Terraform

Por ahora el estado es **local** (`terraform.tfstate` en este directorio, gitignoreado). Sirve
para el MVP con una sola persona provisionando. Antes de sumar gente al equipo o pasar a
staging/producción compartida, migrar a backend remoto (S3 + DynamoDB lock) — no está hecho
todavía porque requeriría un bootstrap propio (bucket + tabla) fuera de este mismo state.

## Setup

```bash
cp terraform.tfvars.example terraform.tfvars
# completar supabase_url y supabase_service_role_key del proyecto Supabase del entorno
terraform init
```

## Orden de aplicación (importante)

App Runner necesita que la imagen ya exista en ECR con el tag configurado (`image_tag`,
default `latest`) — no se puede crear todo en un solo `apply` la primera vez.

1. **Crear solo el ECR repo primero:**
   ```bash
   terraform apply -target=aws_ecr_repository.backend
   ```
2. **Build y push de la imagen** (ver `scripts/push-image.sh` en este mismo directorio, o
   manual):
   ```bash
   aws ecr get-login-password --region eu-central-1 | \
     docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-central-1.amazonaws.com

   docker build -t pap-dev-backend ../..
   docker tag pap-dev-backend:latest <ecr_repository_url>:latest
   docker push <ecr_repository_url>:latest
   ```
3. **Apply completo** (IAM, Secrets Manager, App Runner):
   ```bash
   terraform apply
   ```

Deploys siguientes: solo hace falta build + push de una nueva imagen con el mismo tag —
`auto_deployments_enabled = true` hace que App Runner redespliegue solo al detectar un push
nuevo a ese tag. `terraform apply` no hace falta de nuevo salvo que cambie la infra misma.

## Múltiples entornos

`environment` (dev/staging/prod) namespacea todos los recursos. Usar un `terraform.tfvars`
por entorno y `terraform workspace` (o directorios separados) para no pisar el state de dev
con el de staging/prod.
