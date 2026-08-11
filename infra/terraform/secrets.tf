resource "aws_secretsmanager_secret" "supabase_url" {
  name = "${var.project_name}/${var.environment}/SUPABASE_URL"
}

resource "aws_secretsmanager_secret_version" "supabase_url" {
  secret_id     = aws_secretsmanager_secret.supabase_url.id
  secret_string = var.supabase_url
}

resource "aws_secretsmanager_secret" "supabase_service_role_key" {
  name = "${var.project_name}/${var.environment}/SUPABASE_SERVICE_ROLE_KEY"
}

resource "aws_secretsmanager_secret_version" "supabase_service_role_key" {
  secret_id     = aws_secretsmanager_secret.supabase_service_role_key.id
  secret_string = var.supabase_service_role_key
}
