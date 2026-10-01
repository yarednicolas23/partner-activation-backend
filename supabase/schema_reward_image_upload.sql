-- Partner Activation Program (Kaspersky) — imagem de reward enviada pelo admin
-- Ejecutar en el SQL editor de Supabase, después de schema_reward_images.sql.
--
-- `image_key` é a key do objeto no bucket S3 privado (prefixo "rewards/"),
-- enviado pelo painel admin via presigned POST. O backend devolve
-- `image_url` como URL assinada quando há `image_key`; `image_url` continua
-- servindo para as imagens estáticas de frontend/public/rewards. Só um dos
-- dois é usado por reward (o backend limpa o outro ao salvar).

alter table public.rewards
  add column if not exists image_key text
    check (image_key is null or image_key ~ '^rewards/[0-9a-f-]{36}\.(png|jpg|webp)$');
