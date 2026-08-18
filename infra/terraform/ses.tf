# Notificaciones por email (evidencia subida / milestone completo) — SES en
# modo sandbox: tanto el remitente como cada destinatario de prueba necesitan
# verificarse a mano (AWS manda un link de confirmación al inbox, Terraform
# solo dispara ese request, no lo puede completar).

resource "aws_ses_email_identity" "from" {
  email = var.ses_from_email
}

# Excluye ses_from_email para no declarar la misma identidad de SES dos veces.
resource "aws_ses_email_identity" "test_recipients" {
  for_each = toset(setsubtract(var.ses_test_recipients, [var.ses_from_email]))
  email    = each.value
}

data "aws_iam_policy_document" "backend_ses" {
  statement {
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = ["*"]

    # Restringe a mandar solo desde el remitente verificado — evita que esta
    # credencial se pueda usar para mandar "como" cualquier otra identidad.
    condition {
      test     = "StringEquals"
      variable = "ses:FromAddress"
      values   = [var.ses_from_email]
    }
  }
}

resource "aws_iam_user_policy" "backend_ses" {
  name   = "${var.project_name}-${var.environment}-backend-ses-send"
  user   = aws_iam_user.backend_s3.name
  policy = data.aws_iam_policy_document.backend_ses.json
}
