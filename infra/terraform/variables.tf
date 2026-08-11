variable "aws_region" {
  description = "Región AWS — Frankfurt por defecto (ver CLAUDE.md, decisión de hosting UE)."
  type        = string
  default     = "eu-central-1"
}

variable "project_name" {
  description = "Prefijo para namespacing de recursos (plan-fase1-infraestructura-autenticacion.md §1.2)."
  type        = string
  default     = "pap"
}

variable "environment" {
  description = "dev | staging | prod — un set de recursos namespaced por entorno."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment debe ser dev, staging o prod."
  }
}

variable "image_tag" {
  description = "Tag de la imagen en ECR que App Runner debe correr. CI/CD la actualiza en cada deploy."
  type        = string
  default     = "latest"
}

variable "supabase_url" {
  description = "SUPABASE_URL del proyecto Supabase de este entorno."
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "SUPABASE_SERVICE_ROLE_KEY (secret key, sb_secret_...) del proyecto Supabase de este entorno."
  type        = string
  sensitive   = true
}

variable "cpu" {
  description = "vCPU para App Runner (valores válidos: 0.25, 0.5, 1, 2, 4 vCPU)."
  type        = string
  default     = "0.25 vCPU"
}

variable "memory" {
  description = "Memoria para App Runner (0.5, 1, 2, 3, 4, 6, 8, 10, 12 GB, según cpu elegido)."
  type        = string
  default     = "0.5 GB"
}
