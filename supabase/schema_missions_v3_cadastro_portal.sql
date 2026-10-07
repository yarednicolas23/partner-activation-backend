-- Partner Activation Program (Kaspersky) — Etapa 1, missão "Cadastro no
-- Portal do Parceiro" deja de ser automática (decisión D1, confirmada).
-- Ejecutar en el SQL editor de Supabase, después de schema_missions_v2.sql.
--
-- Antes: evidence_type 'none' → la missão contaba como concluída sin acción
-- del parceiro. Ahora el parceiro envía una comprovação del cadastro y la
-- missão sigue el flujo normal (em análise → aprovada / reprovada pelo ADM).
--
-- Los textos "Como concluir" (description), "Comprovação exigida"
-- (evidence_label) y "Verificação" (fija para toda missão con comprovação:
-- "Revisado manualmente pela equipe Kaspersky.") salen de estas columnas —
-- no hay cambios de código en el frontend.
--
-- Efecto en parceiros existentes: la Etapa 1 vuelve a quedar incompleta para
-- quien no haya enviado esta comprovação (y, por ser secuencial, la Etapa 2
-- queda bloqueada hasta que se apruebe).

update public.milestone_tasks mt
set description =
      'Acesse o Portal do Parceiro Kaspersky, conclua o seu cadastro e envie uma captura de tela que comprove o registro.',
    evidence_type = 'file',
    evidence_label =
      'Captura de tela do cadastro concluído no Portal do Parceiro (PDF, JPG ou PNG).',
    evidence_options = null
from public.milestones m
where mt.milestone_id = m.id
  and m.order_index = 1
  and mt.order_index = 1;
