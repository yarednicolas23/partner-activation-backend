terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Estado local por ahora (MVP, un solo dev provisionando). Migrar a backend
  # remoto S3 + DynamoDB lock antes de que el equipo crezca o se pase a
  # staging/producción compartida — ver README.md de este directorio.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "partner-activation-program"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
