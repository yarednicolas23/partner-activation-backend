-- Partner Activation Program (Kaspersky) — Etapa 3: se retira la missão
-- "Responder ao Quiz de Parceria".
-- Ejecutar en el SQL editor de Supabase, después de schema_missions_v4_press_release_file.sql.
--
-- Etapa 3 queda con 2 missões: 1 KUDOS, 2 Ação de Geração de Demanda (antes 3).
--
-- Efecto en parceiros existentes:
--   * Las comprovações ya enviadas del quiz (solo e-mail, sin archivos en S3)
--     se borran en cascada con la missão.
--   * La conclusión de etapa se calcula en vivo a partir de las missões
--     restantes: quien ya tenía KUDOS + Geração de Demanda aprobadas pasa a
--     ver la Etapa 3 concluida (y la Etapa 4 desbloqueada) sin recibir el
--     e-mail de etapa concluída.
-- Todo corre en una sola transacción (el SQL editor manda el script entero).

delete from public.milestone_tasks mt
using public.milestones m
where mt.milestone_id = m.id and m.order_index = 3 and mt.order_index = 2;

update public.milestone_tasks mt set order_index = 2
from public.milestones m
where mt.milestone_id = m.id and m.order_index = 3 and mt.order_index = 3;
