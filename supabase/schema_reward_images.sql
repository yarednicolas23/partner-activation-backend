-- Partner Activation Program (Kaspersky) — imagen de cada reward
-- Ejecutar en el SQL editor de Supabase, después de schema_rewards.sql.
--
-- Guarda la ruta pública de la imagen (ej. "/rewards/caneca.png", servida
-- desde frontend/public) o una URL absoluta. Nullable: sin imagen, la UI
-- muestra el regalo genérico.

alter table public.rewards
  add column if not exists image_url text;
