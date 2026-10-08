-- Partner Activation Program (Kaspersky) — catálogo oficial de recompensas
-- (decisión D3): UNA recompensa por etapa.
--   Etapa 1 = Kit Premium Onboarding
--   Etapa 2 = Caneca de cerâmica + Case Tecnológico
--   Etapa 3 = Lunchbox Samsonite
--   Etapa 4 = Fone de Ouvido
--   Etapa 5 = Kindle
-- Ejecutar en el SQL editor de Supabase.
--
-- Escrito contra los datos del proyecto actual (IDs fijos: hay títulos
-- repetidos, no se puede apuntar por título). En otro entorno, revisar los IDs.
--
-- Criterio: la recompensa que se queda en cada etapa se ACTUALIZA en el lugar
-- (conserva sus resgates: quien ya la pidió no puede volver a pedirla, por el
-- unique (reward_id, partner_id)). Se BORRAN los registros de prueba y los
-- duplicados — borrar una recompensa borra en cascada sus resgates: los de
-- prueba, y en los duplicados solo hay resgates recusados.
--
-- Imágenes: image_url apunta a frontend/public/rewards/<archivo> (se suben al
-- front). image_key se limpia: si quedara, el backend serviría la imagen
-- vieja de S3 en vez de la del front.

begin;

-- 1. Borrar pruebas y duplicados ---------------------------------------------
delete from public.rewards where id in (
  'fcb80e54-d431-4b66-8c80-04426ae5e31b', -- E1 "Teste notificação de resgate" (prueba)
  '88c05cae-2d47-4dfd-b712-facd22164191', -- E2 "QA reward for ..." (prueba)
  '9a36fc71-b971-4eff-9eb1-bc419ac7a192', -- E3 "QA reward for ..." (prueba)
  '6b50ce03-ceed-4328-9899-0616573d33f2', -- E2 "Case organizador" duplicado (1 resgate recusado)
  'dbe2f5b0-7358-4c9d-87d9-77a93959711b'  -- E2 "Caneca Kaspersky" suelta (1 resgate recusado) — pasa al combo
);

-- 2. Una recompensa por etapa ------------------------------------------------
update public.rewards r
set title = v.title,
    description = v.description,
    type = 'physical',
    milestone_id = m.id,
    image_url = v.image_url,
    image_key = null,
    is_active = true,
    updated_at = now()
from (values
  ('026808f6-fb67-4ada-bc15-98cef8a54118'::uuid, 1, 'Kit Premium Onboarding',
   'Kit premium de boas-vindas ao Kaspersky Partner Quest.',
   '/rewards/kit-premium-onboarding.png'),
  ('e897cc52-e723-4423-a414-667479f21d77'::uuid, 2, 'Caneca de cerâmica + Case Tecnológico',
   'Caneca de cerâmica Kaspersky e case tecnológico para acessórios.',
   '/rewards/caneca-case-tecnologico.png'),
  ('b51b2cf2-979e-4a8a-b532-eeedfeace632'::uuid, 3, 'Lunchbox Samsonite',
   'Lunchbox Samsonite.',
   '/rewards/lunchbox-samsonite.png'),
  -- El fone estaba en la Etapa 5: pasa a la 4 (quien ya lo pidió completó la 4).
  ('a7e5d293-b305-4c48-afb9-a22be3e45198'::uuid, 4, 'Fone de Ouvido',
   'Fone de ouvido sem fio.',
   '/rewards/fone-de-ouvido.png'),
  ('ac4b366e-c421-4e2d-a64e-ee6868282d0e'::uuid, 5, 'Kindle',
   'Leitor digital Kindle.',
   '/rewards/kindle.png')
) as v(id, stage, title, description, image_url)
join public.milestones m on m.order_index = v.stage
where r.id = v.id;

-- 3. Verificación: exactamente 1 recompensa activa por etapa -----------------
do $$
declare
  bad int;
begin
  select count(*) into bad
  from public.milestones m
  where (select count(*) from public.rewards r
         where r.milestone_id = m.id and r.is_active) <> 1;
  if bad > 0 then
    raise exception 'Catálogo inválido: % etapa(s) sin exactamente 1 recompensa ativa', bad;
  end if;
end $$;

commit;
