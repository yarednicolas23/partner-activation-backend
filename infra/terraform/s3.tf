# Bucket privado para evidencias de misiones (PDF/imágenes) — ver
# plan-fase1-infraestructura-autenticacion.md §1.4: subida vía presigned URLs,
# el frontend nunca tiene credenciales AWS directas.

resource "aws_s3_bucket" "evidence" {
  bucket = "${var.project_name}-${var.environment}-evidence"
}

resource "aws_s3_bucket_public_access_block" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# El navegador del partner sube directo al bucket con un presigned POST
# (ver frontend/src/app/dashboard/milestones-section.tsx) — requiere CORS
# habilitado para los orígenes del frontend.
resource "aws_s3_bucket_cors_configuration" "evidence" {
  bucket = aws_s3_bucket.evidence.id

  cors_rule {
    allowed_methods = ["POST"]
    allowed_origins = var.evidence_bucket_cors_origins
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

# Usuario IAM dedicado con access key — interino mientras el backend corre en
# Railway/local (App Runner todavía no está activo). Cuando lo esté, migrar
# esta misma policy al instance role de App Runner (iam.tf) y dar de baja
# estas access keys — ver nota en el plan de esta tarea.
resource "aws_iam_user" "backend_s3" {
  name = "${var.project_name}-${var.environment}-backend-s3"
}

resource "aws_iam_access_key" "backend_s3" {
  user = aws_iam_user.backend_s3.name
}

data "aws_iam_policy_document" "backend_s3" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject"]
    resources = ["${aws_s3_bucket.evidence.arn}/*"]
  }
}

resource "aws_iam_user_policy" "backend_s3" {
  name   = "${var.project_name}-${var.environment}-backend-s3-evidence"
  user   = aws_iam_user.backend_s3.name
  policy = data.aws_iam_policy_document.backend_s3.json
}
