# OIDC federado GitHub Actions → AWS: el pipeline de CI/CD hace
# assume-role sin credenciales de larga duración guardadas en GitHub.
#
# NOTA: el OIDC provider es un recurso *global de la cuenta* (no por
# entorno). Si más adelante se provisiona staging/prod como states de
# Terraform separados, este archivo debe vivir en uno solo (o moverse a un
# módulo de "bootstrap de cuenta" aparte) — aplicarlo dos veces falla con
# "already exists".

variable "github_repo" {
  description = "owner/repo de GitHub autorizado a asumir el rol de deploy, ej. yarednicolas23/partner-activation-backend."
  type        = string
  default     = "yarednicolas23/partner-activation-backend"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Restringido a la rama main del repo — ajustar si el pipeline debe
    # correr también desde otras ramas/tags.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${var.project_name}-${var.environment}-github-actions-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "github_actions_ecr_push" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [aws_ecr_repository.backend.arn]
  }
}

resource "aws_iam_role_policy" "github_actions_ecr_push" {
  name   = "${var.project_name}-${var.environment}-github-actions-ecr-push"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_ecr_push.json
}

output "github_actions_role_arn" {
  description = "ARN a configurar como secret AWS_DEPLOY_ROLE_ARN en GitHub Actions."
  value       = aws_iam_role.github_actions_deploy.arn
}
