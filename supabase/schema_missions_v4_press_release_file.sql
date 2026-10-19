-- Partner Activation Program (Kaspersky) — Etapa 2, missão "Divulgar a
-- parceria": en la opción "Press Release" la comprovação pasa a ser el
-- ARCHIVO del comunicado, no un link.
-- Ejecutar en el SQL editor de Supabase, después de schema_missions_v3_cadastro_portal.sql.
--
-- Solo cambia la entrada press_release de evidence_options (evidence_type
-- 'url' → 'file' y su evidence_label); el resto de las opciones queda igual.
-- Sin cambios de código: el frontend y el backend ya resuelven el tipo de
-- comprovação a partir de la opción elegida.
--
-- Efecto en parceiros existentes: los envíos ya hechos con link se mantienen
-- tal cual (no se invalidan); los nuevos envíos de Press Release piden archivo.

update public.milestone_tasks mt
set evidence_options = (
  select jsonb_agg(
           case when opt->>'key' = 'press_release'
                then opt || '{"evidence_type": "file", "evidence_label": "Arquivo do press release publicado (PDF, JPG ou PNG)."}'::jsonb
                else opt
           end
           order by ord)
  from jsonb_array_elements(mt.evidence_options) with ordinality as e(opt, ord)
)
from public.milestones m
where mt.milestone_id = m.id
  and m.order_index = 2
  and mt.order_index = 5
  and mt.evidence_options is not null;
