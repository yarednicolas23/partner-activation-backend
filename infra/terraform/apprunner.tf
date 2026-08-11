# Requiere que la imagen ya exista en ECR con el tag `var.image_tag` antes
# del primer apply — ver README.md ("orden de aplicación").
resource "aws_apprunner_service" "backend" {
  service_name = "${var.project_name}-${var.environment}-backend"

  source_configuration {
    auto_deployments_enabled = true

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "3000"

        runtime_environment_variables = {
          NODE_ENV = "production"
          PORT     = "3000"
        }

        runtime_environment_secrets = {
          SUPABASE_URL              = aws_secretsmanager_secret.supabase_url.arn
          SUPABASE_SERVICE_ROLE_KEY = aws_secretsmanager_secret.supabase_service_role_key.arn
        }
      }
    }
  }

  instance_configuration {
    cpu                = var.cpu
    memory             = var.memory
    instance_role_arn  = aws_iam_role.apprunner_instance.arn
  }

  # GET / no requiere auth (app.controller.ts) — sirve tal cual de health check.
  health_check_configuration {
    protocol            = "HTTP"
    path                = "/"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }
}
