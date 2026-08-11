output "ecr_repository_url" {
  description = "URL del repo ECR — usar para docker tag/push."
  value       = aws_ecr_repository.backend.repository_url
}

output "apprunner_service_url" {
  description = "URL pública del servicio (https://xxxx.eu-central-1.awsapprunner.com)."
  value       = aws_apprunner_service.backend.service_url
}

output "apprunner_service_arn" {
  value = aws_apprunner_service.backend.arn
}

output "aws_region" {
  value = var.aws_region
}
