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

# GitHub agrega los IDs numéricos inmutables del owner/repo al claim "sub"
# (repo:<owner>@<ownerId>/<repo>@<repoId>:ref:...) — no el simple "owner/repo"
# que documentan la mayoría de los tutoriales. Confirmado leyendo el
# principalId real en CloudTrail para AssumeRoleWithWebIdentity después de
# que la condición "owner/repo" sin IDs rechazara todos los intentos con
# "Not authorized" (2026-08-21). IDs de este repo: owner=15717668, repo=1326242338.
variable "github_owner_id" {
  description = "ID numérico inmutable del owner (github.com/users/<owner> → \"id\" en la API, o desde el sub claim real en CloudTrail)."
  type        = string
  default     = "15717668"
}

variable "github_repo_id" {
  description = "ID numérico inmutable del repo (GET /repos/<owner>/<repo> → \"id\" en la API de GitHub)."
  type        = string
  default     = "1326242338"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  # GitHub migró de DigiCert a Let's Encrypt (CA "ISRG Root X1") en algún
  # momento sin avisar — el thumbprint viejo (DigiCert, el que usan casi
  # todos los tutoriales) quedó obsoleto y rompía el assume-role con el
  # mismo "Not authorized" genérico. Se dejan ambos por las dudas de que
  # GitHub vuelva a rotar.
  thumbprint_list = [
    "ab9d0263244dd0326eb67015705a667e79cfe998", # ISRG Root X1 (actual, 2026-08-21)
    "6938fd4d98bab03faadb97b34396831e3780aea1", # DigiCert (histórico)
  ]
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
    # correr también desde otras ramas/tags. Usa los IDs inmutables (ver
    # nota arriba) — StringEquals, no StringLike, porque ya es el valor
    # exacto y no un patrón.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${split("/", var.github_repo)[0]}@${var.github_owner_id}/${split("/", var.github_repo)[1]}@${var.github_repo_id}:ref:refs/heads/main"]
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
