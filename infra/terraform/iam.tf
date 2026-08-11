# App Runner necesita dos roles distintos con propósitos separados:
# - "access role": lo asume el *servicio* de App Runner para hacer el pull
#   de la imagen desde ECR privado durante el build/deploy.
# - "instance role": lo asume el *contenedor en ejecución* — lo necesita
#   para leer los secrets de Secrets Manager que se inyectan como env vars.

data "aws_caller_identity" "current" {}

# --- Access role (ECR pull) ---

data "aws_iam_policy_document" "apprunner_ecr_access_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_ecr_access" {
  name               = "${var.project_name}-${var.environment}-apprunner-ecr-access"
  assume_role_policy = data.aws_iam_policy_document.apprunner_ecr_access_assume.json
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# --- Instance role (runtime del contenedor) ---

data "aws_iam_policy_document" "apprunner_instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apprunner_instance" {
  name               = "${var.project_name}-${var.environment}-apprunner-instance"
  assume_role_policy = data.aws_iam_policy_document.apprunner_instance_assume.json
}

data "aws_iam_policy_document" "apprunner_instance_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.supabase_url.arn,
      aws_secretsmanager_secret.supabase_service_role_key.arn,
    ]
  }
}

resource "aws_iam_role_policy" "apprunner_instance_secrets" {
  name   = "${var.project_name}-${var.environment}-apprunner-secrets-access"
  role   = aws_iam_role.apprunner_instance.id
  policy = data.aws_iam_policy_document.apprunner_instance_secrets.json
}
