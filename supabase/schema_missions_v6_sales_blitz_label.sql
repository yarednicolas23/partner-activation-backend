-- Partner Activation Program (Kaspersky) — Etapa 3, missão "Ação de Geração
-- de Demanda": la opción "Blitz interna de vendas" deja de decir
-- "(KUDOS pode ser usado)".
-- Ejecutar en el SQL editor de Supabase, después de schema_missions_v5_remove_quiz.sql.
--
-- Solo cambia el label de la opción sales_blitz; la key no cambia, así que las
-- comprovações ya enviadas con esa opción siguen asociadas.

update public.milestone_tasks mt
set evidence_options = (
  select jsonb_agg(
           case when opt->>'key' = 'sales_blitz'
                then opt || '{"label": "Blitz interna de vendas"}'::jsonb
                else opt
           end
           order by ord)
  from jsonb_array_elements(mt.evidence_options) with ordinality as e(opt, ord)
)
from public.milestones m
where mt.milestone_id = m.id
  and m.order_index = 3
  and mt.evidence_options @> '[{"key": "sales_blitz"}]';
